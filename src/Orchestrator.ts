import {SubscriptionObserver} from './SubscriptionObserver.interface';
import {
  // EventType,
  ObservableEvent,
  NextEvent,
  ErrorEvent,
  CompleteEvent
} from './ObservableEvents';
import {State} from './State';



// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Orchestrator<T, R> {
  pending: number;
  state: State;
  set(state: State): void;
}

// const CompletableStates = new Set([State.Flowing, State.Completing]);


const isFlowing = <T, R>({state}: Orchestrator<T, R>) => State.isFlowing(state);
// const isCompleting = <T, R>({state}: Orchestrator<T, R>) => state === State.Completing;
// const isComplete = <T, R>({state}: Orchestrator<T, R>) => state === State.Complete;
// const isErrored = <T, R>({state}: Orchestrator<T, R>) => state === State.Errored;

const hasPending = <T, R>({pending}: Orchestrator<T, R>) => pending <= 0;
const isCompleting = <T, R>({state}: Orchestrator<T, R>) => State.isCompleting(state);

export namespace Orchestrator {
  export interface Observer<T> extends SubscriptionObserver<T> {
    push(...values: T[]): void;
    next(...values: T[]): void;
  }

  export type Subscriber<T, R> = (
    event: ObservableEvent<T>,
    observer: Observer<R>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any | Promise<any>;
}



function createOrchestratorObserver<T, R>(
  observer: SubscriptionObserver<R>,
  orchestrator: Orchestrator<T, R>
): Orchestrator.Observer<R> {

  function push(...values: R[]) {
    if (isFlowing(orchestrator) || isCompleting(orchestrator)) {
      for (const value of values) observer.next(value);
    } else {
      console.trace();
      console.log('state', orchestrator.state, values);
    }
  }

  function next(...values: R[]) {
    console.log('before', orchestrator.pending);
    push(...values);
    --orchestrator.pending;

    // console.log(isCompleting(orchestrator));
    if (isCompleting(orchestrator)) {
      console.log('after', orchestrator.pending);
      if (hasPending(orchestrator)) {
        orchestrator.state = State.Complete;
        observer.complete();
      }
    }
  }

  function error(err: unknown) {
    if (isFlowing(orchestrator)) {
      orchestrator.state = State.Errored;
      observer.error(err);
    }
  }

  function complete() {
    if (isFlowing(orchestrator)) {
      orchestrator.state = State.Completing;
      if (hasPending(orchestrator)) {
        orchestrator.state = State.Complete;
        observer.complete();
      }
    }
  }

  return {
    next,
    push,
    error,
    complete,
    get closed(): boolean { return !isFlowing(orchestrator); }
  };
}

type Emitter<T> = (event: ObservableEvent<T>) => Promise<void>;

function createEmitter<T, R>(
  observer: Orchestrator.Observer<R>,
  subscriber: Orchestrator.Subscriber<T, R>
): Emitter<T> {
  return async function (event: ObservableEvent<T>) {
    try {
      await subscriber(event, observer);
    } catch (error) {
      await subscriber(ErrorEvent.create(error), observer);
    }
  };
}

const COMPLETE_EVENT: Readonly<CompleteEvent> = CompleteEvent.create();

export class Orchestrator<T, R> {
  pending = 0;
  state: State = State.Flowing;
  observer: Orchestrator.Observer<R>;
  emitter: Emitter<T>;

  constructor(
    observer: SubscriptionObserver<R>,
    subscriber: Orchestrator.Subscriber<T, R>
  ) {
    this.observer = createOrchestratorObserver<T, R>(observer, this);
    this.emitter = createEmitter(this.observer, subscriber);
  }

  set(state: State): void {
    this.state = state;
  }

  next(value: T): void {
    if (this.state === State.Flowing) {
      this.pending++;
      this.emitter(NextEvent.create(value));
    }
  }

  error(err: unknown): void {
    if (this.state === State.Flowing) {
      this.set(State.Errored);
      this.emitter(ErrorEvent.create(err));
    }
  }

  complete(): void {
    if (this.state === State.Flowing) {
      console.log('completing');
      this.set(State.Completing);
      this.emitter(COMPLETE_EVENT);
    }
  }
}
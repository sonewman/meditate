import {AsyncObserableGenerator} from './AsyncGenerator';
import {kSubscriber} from './constants';
import {Observer} from './Observer.interface';
import {
  iterate,
  isAsyncIterable,
  isIterable
} from './iterate';
import { SubscriptionObserver } from './SubscriptionObserver.interface';
import { Subscriber, Unsubscriber } from './Subscriber';
import { Orchestrator } from './Orchestrator';
import {
  ObservableEvent,
  NextEvent,
  ErrorEvent,
  CompleteEvent
} from './ObservableEvents';

export interface Observable<T> {
  subscribe(observer: Observer<T>): Promise<Unsubscriber>;
}

function GetSubscriber<T>(observable: Observable<T>): Subscriber<T> {
  return observable[kSubscriber];
}

type FromPromise<T> = Promise<Iterable<T> | AsyncIterable<T>>;

type FromIterable<T> =
  | Iterable<T | Promise<T>>
  | AsyncIterable<T | Promise<T>>

type FromFunction<T> =
  | (() => Generator<T>)
  | (() => AsyncGenerator<T>)
  | (() => FromIterable<T>);

type ReduceFn<T, R> = (acc: R, value: T, index: number) => R | Promise<R>;

export class Observable<T> {
  [kSubscriber]: Subscriber<T>;

  constructor(subscriber: Subscriber<T>) {
    this[kSubscriber] = subscriber;
  }

  subscribe(observer: Observer<T>): Promise<Unsubscriber> {
    return Subscriber.Execute(
      GetSubscriber(this),
      observer
    );
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return new AsyncObserableGenerator(this);
  }

  map<R>(fn: ((value: T, index: number) => R | Promise<R>)): Observable<R> {
    return new Observable<R>((observer, index = -1) => {
      this.subscribe(
        new Orchestrator(observer, async function subscriber(event: ObservableEvent<T>, observer: Orchestrator.Observer<R>) {
          // if (NextEvent.is<T>(event)) observer.next(await fn(event.value, ++index));
          if (NextEvent.is<T>(event)) observer.push(await fn(event.value, ++index));
          observer.next();
          // if (CompleteEvent.is<T>(event)) observer.complete();
          // if (ErrorEvent.is<T>(event)) observer.error(event.error);
        })
      );
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async forEach(fn: (value: T, index: number) => any): Promise<void> {
    let index = -1;
    for await (const value of this) {
      console.log(value);
      fn(value, ++index);
    }
  }

  reduce<R>(fn: (acc: R, value: T, index: number) => R | Promise<R>): Observable<R>;
  reduce<R>(fn: (acc: R, value: T, index: number) => R | Promise<R>, acc: R): Observable<R>;
  reduce<R>(...args: [ReduceFn<T, R>] | [ReduceFn<T, R>, R]): Observable<R> {
    return new Observable<R>(async observer => {
      let pending = 0;
      let completed = false;
      let hasError = false;
      let index = -1;

      const [fn] = args;

      let hasSetAcc = false;
      let accumulator;

      if (args.length > 2) {
        ([, accumulator] = args);
        hasSetAcc = true;
        index = 0;
      }

      for await (const value of this) {
        pending += 1;

        try {
          if (hasSetAcc) {
            const result = await fn(accumulator as R, value, ++index);
              if (!hasError) {
                observer.next(result);
                if (--pending === 0 && completed && !hasError) {
                  observer.complete();
                }
              }
          } else {
            accumulator = value;
            hasSetAcc = true;
          }
        } catch (e) {
          hasError = true;
          observer.error(e);
        }
      }

      completed = true;
    });
  }

  static from<T>(x: FromIterable<T> | FromFunction<T> | FromPromise<T>): Observable<T> {
    if (x == null) throw new TypeError(x + ' is not an object');

    const input = typeof x === 'function' ? x() : x;

    if (isPromise(input)) {
      return new Observable<T>(observer => void ExecutePromise<T>(observer, input as FromPromise<T>));
    }

    if (isIterable(input) || isAsyncIterable(input)) {
      return new Observable<T>(observer => void DefaultIterate(input, observer));
    }

    throw new TypeError(x + ' is not an iterable');
  }

  static of<T>(...input: (T | Promise<T>)[]): Observable<T> {
    return new Observable<T>(observer => void DefaultIterate(input, observer));
  }
}

function DefaultIterate<T>(
  iterable: Iterable<T | Promise<T>> | AsyncIterable<T | Promise<T>>,
  observer: SubscriptionObserver<T>
): Promise<void> {
  return iterate(iterable, DefaultNext(observer), DefaultError(observer), DefaultComplete(observer));
}

function DefaultNext<T>(observer: SubscriptionObserver<T>) {
  return function (value: T) { observer.next(value); };
}

function DefaultError<T>(observer: SubscriptionObserver<T>) {
  return function (err: unknown) { observer.error(err); };
}

function DefaultComplete<T>(observer: SubscriptionObserver<T>) {
  return function () { observer.complete(); };
}


export async function toPromise<T>(observer: Observable<T>, all: T[] = []): Promise<T[]> {
  await observer.forEach(value => all.push(value));
  return all;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPromise(p: any): p is Promise<any> {
  return !!p && typeof p.then === 'function' && typeof p.catch === 'function';
}

async function ExecutePromise<T>(
  observer: SubscriptionObserver<T>,
  promise: FromPromise<T>
) {
  const iterable = await promise;
  try {
    for await (const value of iterable) {
      observer.next(value);
    }
  } catch (e) {
    observer.error(e);
  }
  observer.complete();
}


export default Observable;
// enum State {
//   Ready = 'ready',
//   Queued = 'queued',
//   Closed = 'closed',
//   Flowing = 'flowing'
// }

enum EventType {
  Next = 'next',
  Error = 'error',
  Complete = 'complete'
}

interface NextEvent<T> {
  type: EventType.Next;
  value: T;
}

interface ErrorEvent {
  type: EventType.Error;
  value: unknown;
}

interface CompleteEvent {
  type: EventType.Complete;
}


type ObservableEvent<T> = NextEvent<T> | ErrorEvent | CompleteEvent;

class Future<T> {
  promise: Promise<T>;
  resolve!: (value: T | Promise<T>) => void;
  reject!: (err: unknown) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class Link<T> {
  value: T ;
  next: Link<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

class LinkedList<T> {
  head: Link<T> | null = null;
  tail: Link<T> | null = null;
  length = 0;


  push(value: T) {
    this.length += 1;

    const link = new Link<T>(value);
    if (!this.head || !this.tail) {
      this.head = this.tail = link;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.tail.next = link;
      this.tail = link;
    }
  }

  shift(): T | undefined {
    const head = this.head;
    if (head) {
      this.head = head.next ?? null;

      if (!this.head) {
        this.tail = null;
      }

      this.length -= 1;
      return head.value;
    }
  }
}


interface Observer<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  next?: (value: T) => any | Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: (err?: unknown) => any | Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  complete?: () => any | Promise<any>;
}


interface Observable<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribe(observer: Observer<T>): any;
}


export class AsyncObserableGenerator<T> implements AsyncIterableIterator<T> {
  pendingList: LinkedList<ObservableEvent<T>> = new LinkedList()
  pendingFutures: LinkedList<Future<IteratorResult<T>>> = new LinkedList();

  constructor(observable: Observable<T>) {

    const handleEvent = (event: ObservableEvent<T>) => queueMicrotask(async () => {

      const nextFuture = this.pendingFutures.shift();
      if (nextFuture) {
        switch (event.type) {
          case EventType.Next:
            return nextFuture.resolve({value: event.value, done: false });
          case EventType.Complete:
            return nextFuture.resolve({value: undefined, done: true });
          case EventType.Error:
            return nextFuture.reject(event.value);
        }
      }

      this.pendingList.push(event);
    });

    observable.subscribe({
      next: (value: T) => handleEvent({type: EventType.Next, value}),
      error: (value: unknown) => handleEvent({type: EventType.Error, value}),
      complete: () => handleEvent({type: EventType.Complete})
    });
  }

  // NOTE: 'next' is defined using a tuple to ensure we report the correct assignability errors in all places.
  async next(): Promise<IteratorResult<T>> {
    const event = this.pendingList.shift();

    switch (event?.type) {
      case EventType.Next:
        return {value: event.value, done: false };
      case EventType.Complete:
        return {value: undefined, done: true };
      case EventType.Error:
        throw event.value;
    }

    const future = new Future<IteratorResult<T>>();
    this.pendingFutures.push(future);
    return future.promise;
  }

  // return(value?: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T>> {

  // }

  // throw?(e?: any): Promise<IteratorResult<T>> {

  // }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this;
  }
}
export enum EventType {
  Next = 'next',
  Error = 'error',
  Complete = 'complete'
}

export interface NextEvent<T> {
  type: EventType.Next;
  value: T;
}

export interface ErrorEvent {
  type: EventType.Error;
  error: unknown;
}

export interface CompleteEvent {
  type: EventType.Complete;
}

export type ObservableEvent<T> = NextEvent<T> | ErrorEvent | CompleteEvent;


export namespace NextEvent {
  export const create = <T>(value: T): NextEvent<T> => ({
    type: EventType.Next,
    value
  });

  export const is = <T>(event: ObservableEvent<T>): event is NextEvent<T> => {
    return event.type === EventType.Next;
  };
}

export namespace ErrorEvent {
  export const create = (error: unknown): ErrorEvent => ({
    type: EventType.Error,
    error
  });

  export const is = <T>(event: ObservableEvent<T>): event is ErrorEvent => {
    return event.type === EventType.Error;
  };
}

export namespace CompleteEvent {
  export const create = (): CompleteEvent => ({ type: EventType.Complete });

  export const is = <T>(event: ObservableEvent<T>): event is CompleteEvent => {
    return event.type === EventType.Complete;
  };
}
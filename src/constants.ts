declare global {
  interface SymbolConstructor {
    observable: symbol;
  }
}

Symbol.observable = Symbol.observable ?? Symbol('observable');

export const kSubscription = Symbol('Subscription');
export const kSubscriber = Symbol('Subscriber');
export const kSubObserver = Symbol('Observer');
export const kSubCleanup = Symbol('Cleanup');
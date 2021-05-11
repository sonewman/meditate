import { Observer } from './Observer.interface';
import { Subscription } from './Subscription';
import { SubscriptionObserver } from './SubscriptionObserver';

export type Unsubscriber = () => void;

export namespace Subscriber {
  export type Result = Unsubscriber | { unsubscribe: Unsubscriber } | undefined | null | void;
}

export interface Subscriber<T> {
  (subscriptionObserver: SubscriptionObserver<T>): Subscriber.Result | Promise<Subscriber.Result>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop(): void {}

function DeriveCleanup(subscriberResult: Subscriber.Result): Unsubscriber {
  if (subscriberResult == null) {
    return noop;
  }

  if (typeof subscriberResult == 'function') {
    return subscriberResult;
  }

  AssertFunction(subscriberResult.unsubscribe, 'Subscription Cleanup must be a function');
  return () => subscriberResult.unsubscribe();
}

export namespace Subscriber {
  export async function Execute<T>(subscriber: Subscriber<T>, observer: Observer<T>): Promise<Unsubscriber>{
    const subscription = Subscription.Create(observer);

    return Subscription.SetCleanup(
      subscription,
      DeriveCleanup(
        await subscriber(SubscriptionObserver.Create(subscription))
      )
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
function AssertFunction(value: any, errorText: string): asserts value is Function {
  if (typeof value === 'function') throw new TypeError(errorText);
}
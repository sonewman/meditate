import {kSubscription} from './constants';
import {Observer} from './Observer.interface';
import {
  Subscription as ISubscription
} from './Subscription.interface';
import {Subscription} from './Subscription';

export class SubscriptionObserver<T> {
  [kSubscription]: ISubscription<T>;

  constructor(subscription: ISubscription<T>) {
    this[kSubscription] = subscription;
  }

  get closed(): boolean {
    return Subscription.Closed(GetSubscription_(this));
  }

  next(value: T): void {
    SubscriptionObserver.next(this, value);
  }

  error(err: unknown): void {
    SubscriptionObserver.error(this, err);
  }

  complete(): void {
    SubscriptionObserver.complete(this);
  }
}

function GetSubscription_<T>(subscriptionObserver: SubscriptionObserver<T>): ISubscription<T> {
  return subscriptionObserver[kSubscription];
}

export namespace SubscriptionObserver {
  export async function next<T>(subscriptionObserver: SubscriptionObserver<T>, value: T): Promise<void> {
    await GetSubscriptionObserver(subscriptionObserver)?.next?.(value);
  }

  export async function error<T>(subscriptionObserver: SubscriptionObserver<T>, err: unknown): Promise<void> {
    await GetSubscriptionObserver(subscriptionObserver)?.error?.(err);
  }

  export async function complete<T>(subscriptionObserver: SubscriptionObserver<T>): Promise<void> {
    await GetSubscriptionObserver(subscriptionObserver)?.complete?.();
  }

  export function GetSubscriptionObserver<T>(subscriptionObserver: SubscriptionObserver<T>): Observer<T> | undefined {
    const subscription = GetSubscription_(subscriptionObserver);
    if (Subscription.Closed(subscription)) return;
    return Subscription.GetObserver(subscription);
  }

  export const GetSubscription = GetSubscription_;
  // export function GetSubscription<T>(subscriptionObserver: SubscriptionObserver<T>): ISubscription<T> {
  //   return subscriptionObserver[kSubscription];
  // }

  export function Create<T>(subscription: ISubscription<T>): SubscriptionObserver<T> {
    return new SubscriptionObserver(subscription);
  }

  export type Interface<T> = import('./SubscriptionObserver.interface').SubscriptionObserver<T>;
}
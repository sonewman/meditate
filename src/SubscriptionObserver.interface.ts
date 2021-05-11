// import {
//   kSubscription
// } from './constants';
// import {Subscription} from './Subscription.interface';

export interface SubscriptionObserver<T> {
  closed: boolean;
  next(value: T): void;
  error(err: unknown): void;
  complete(): void;
}
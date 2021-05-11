import {
  kSubObserver,
  kSubCleanup
} from './constants';
import {Observer} from './Observer.interface';

type Cleanup = () => void;

export interface Subscription<T> {
  [kSubObserver]: Observer<T>;
  [kSubCleanup]: Cleanup | undefined;
  closed: boolean;
  unsubscribe(): void;
}

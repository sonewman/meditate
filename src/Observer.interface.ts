export interface Observer<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  next?: (value: T) => any | Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: (err?: unknown) => any | Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  complete?: () => any | Promise<any>;
}
/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any */

export async function iterate<T>(
  iterable: Iterable<T | Promise<T>> | AsyncIterable<T | Promise<T>>,
  next: (value: T) => any,
  error: (err: unknown) => any,
  complete: () => any
): Promise<void> {
  let pending = 0;
  let completed = false;
  let hasError = false;

  const it = (value: T | Promise<T>) => {
    pending += 1;

    queueMicrotask(async () => {
      try {
        if (!hasError) {
          const result = await value;

          if (!hasError) {

            next(result);
            if (--pending === 0 && completed && !hasError) {
              complete();
            }
          }
        }
      } catch (e) {
        hasError = true;
        error(e);
      }
    });
  };

  if (isAsyncIterable(iterable)) {
    for await (const value of iterable) it(value);
  } else {
    for (const value of iterable) it(value);
  }

  completed = true;
  if (pending === 0) queueMicrotask(() => complete());
}

export function isAsyncIterable(iterable: any): iterable is AsyncIterable<any> {
  return Symbol.asyncIterator in iterable;
}

export function isIterable(iterable: any): iterable is Iterable<any> {
  return Symbol.iterator in iterable;
}
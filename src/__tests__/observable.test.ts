import {Observable, toPromise} from '../Observable';

describe('Observable test', () => {

  // it('it should work', async () => {
  //   const observable = new Observable<number>(observer => {
  //     [ 1, 2, 3, 4, 5 ].forEach(v => observer.next(v));
  //     observer.complete();
  //   });

  //   expect(await new Promise((resolve) => {
  //     const results: number[] = [];
  //     observable.subscribe({
  //       next: results.push.bind(results),
  //       complete: () => resolve(results)
  //     });
  //   })).toEqual([ 1, 2, 3, 4, 5 ]);
  // });

  // it('it should work2', async () => {
  //   const observable = new Observable<number>(observer => {
  //     [ 1, 2, 3, 4, 5 ].forEach(v => observer.next(v));
  //     observer.complete();
  //   });

  //   const results = [];

  //   for await (const value of observable) {
  //     results.push(value);
  //   }

  //   expect(results).toEqual([ 1, 2, 3, 4, 5 ]);
  // });

  it('it should work3', async () => {
    expect(
      await toPromise(
        Observable.from([ 1, 2, 3, 4, 5 ].map(async x => x))
          .map(async x => x * 2)
      )
    ).toEqual([ 2, 4, 6, 8, 10 ]);
  });
});
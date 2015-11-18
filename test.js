const desc = require('macchiato');
const Promise = require('bluebird');
const Meditate = require('./');

desc('meditate.Meditate')
.should('push data through when pulled - this is only safe with sync or deterministic data', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  var i = -1;

  var called = false;
  const obs = Meditate(function (data, push, end) {
    called = true;
    ++i < (a.length - 1) ? push(a[i]) : end(a[i]);
  });

  const b = [];
  for (var v of obs) b.push(v);

  return Promise.all(b).then(function (res) {
    t.eqls(res, a);
    t.assert(called);
  });
})
.should('optimistically pull data out - which is provided thereafter', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  var i = 0;

  var called = false;
  const obs = Meditate(function () {
    return new Promise(function (resolve) {
      process.nextTick(function () {
        called = true;
        resolve(a[i]);
        i += 1;
      });
    });
  });

  const b = [];

  for (var j = 0; j < a.length; j++) {
    b.push(obs.next().value);
  }

  return Promise.all(b).then(function (res) {
    t.eqls(res, a);
    t.assert(called);
  });
})
.should('push data manually returning returned value', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = [];

  const obs = Meditate(function (d) {
    return d;
  });

  for (var i = 0; i < a.length; i++) {
    b.push(obs.next(a[i]).value);
  }

  obs.end();

  return Promise.all(b).then(function (res) {
    t.eqls(res, a);
  });
})
.should('call end callback passing on returned value', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Meditate();
  const dest = src.pipe(Meditate());

  for (var i = 0; i < a.length; i++) src.sync(a[i]);

  const d = [];
  for (i = 0; i < a.length; i++) d.push(dest.read());

  return Promise.all(d).then(function (res) {
    t.eqls(res, a);
  });
})
.should('allow end to be called multiple times resolving the same promise', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Meditate();

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  var end1 = src.end();
  var end2 = src.end();

  t.equals(end1, end2);

  return end1.then(function (res1) {
    return end2.then(function (res2) {
      t.eqls(res1, res2);
    });
  });
})
.should('multiplex output when piped to other streams/observables', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = [];
  const c = [];

  const src = Meditate();
  const dest1 = Meditate();
  const dest2 = Meditate();

  src.pipe(dest1);
  src.pipe(dest2);

  for (var i = 0; i < a.length; i++) src.next(a[i]);
  for (i = 0; i < a.length; i++) {
    b.push(dest1.next().value);
    c.push(dest2.next().value);
  }

  return Promise.all([
    Promise.all(b).then(function (res) { t.eqls(res, a); }),
    Promise.all(c).then(function (res) { t.eqls(res, a); })
  ]);
})
.should('allow multiplex to multiple streams which are not immediately read', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = ['a', 'b', 'c', 'd'];

  const src = Meditate();
  const dest1 = Meditate();
  const dest2 = Meditate();

  src.pipe(dest1);
  src.pipe(dest2);

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  return Promise.all([
    dest1.end().then(function (res) { t.eqls(res, b); }),
    dest2.end().then(function (res) { t.eqls(res, b); })
  ]);
})
.should('allow multiplex to multiple streams which are not immediately read', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = ['a', 'b', 'c', 'd'];
//  const a = ['a', 'b'];

  const src = Meditate();
  const dest1 = Meditate();
  const dest2 = Meditate();

  src.pipe(dest1);
  src.pipe(dest2);

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  return Promise.all([
    dest1.end().then(function (res) { t.eqls(res, b); }),
    dest2.end().then(function (res) { t.eqls(res, b); })
  ]);
})
.should('allow pipe to take an array of streams to pipe to', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Meditate();
  const dest1 = Meditate();
  const dest2 = Meditate();

  src.pipe([dest1, dest2]);

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  return Promise.all([
    dest1.end().then(function (res) { t.eqls(res, a); }),
    dest2.end().then(function (res) { t.eqls(res, a); })
  ]);
})
.should('flush to pipes when added after the data is added', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = [];
  const c = [];

  const src = Meditate();

  var i;
  for (i = 0; i < a.length; i++) src.sync(a[i]);

  const dest1 = src.pipe(Meditate());
  const dest2 = src.pipe(Meditate());

  for (i = 0; i < a.length; i++) b.push(dest1.next().value);
  for (i = 0; i < a.length; i++) c.push(dest2.next().value);

  return Promise.all([
    Promise.all(b).then(function (res) { t.eqls(res, a); }),
    Promise.all(c).then(function (res) { t.eqls(res, a); })
  ]);
})
.should('allow corking capabilities', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const src = Meditate().cork();

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  return src.end().then(function (res) { t.eqls(res, a); });
})
.should('uncork should release corked', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  var transformCalled = false;
  const src = Meditate(function (data) {
    transformCalled = true;
    return data;
  }).cork();

  const b = [];

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  t.isFalse(transformCalled);
  src.uncork();

  for (i = 0; i < a.length; i++) b.push(src.read());

  return Promise.all(b).then(function (res) {
    t.assert(transformCalled);
    t.eqls(res, a);
  });
})
.should('return corked data fom call to end', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Meditate().cork();

  for (var i = 0; i < a.length; i++) src.next(a[i]);

  return src.end().then(function (res) { t.eqls(res, a); });
})
.should('return empty array from end if no data', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = [];

  const src = Meditate();
  for (var i = 0; i < a.length; i++)
    b.push(src.next(a[i]).value);

  return src.end().then(function (res) {
    t.eqls(res, []);

    return Promise.all(b).then(function (chunks) {
      t.eqls(chunks, a);
    });
  });
})
.should('not return buffered values if not consumed', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const src = Meditate();

  for (var i = 0; i < a.length; i++) src.sync(a[i]);
  return src.end().then(function (res) { t.eqls(res, a); });
})
.should('pass on all corked values to piped dest on uncork', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Meditate().cork();
  const dest = src.pipe(Meditate());

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  const d = [];
  for (i = 0; i < a.length; i++) d.push(dest.read());

  src.end();

  return Promise.all(d).then(function (res) {
    t.eqls(res, a);
  });
})
.should('return flushed data from end if not read', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Meditate();

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  return src.end().then(function (v) { t.eqls(v, a); });
})
.should('return promise from end handle on end', function (t) {
  const a = [1, 2, 3, 4, 5];

  const src = Meditate(null, function (end) {
    return end.then(function (v) {
      for (var j = 0; j < v.length; j++)
        v[j] = v[j] * 2;

        return v;
    });
  });

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  return src.end()
    .then(function (values) { t.eqls(values, [2, 4, 6, 8, 10]); });
})
.should('handle error returned from iterator', function (t) {
  const err = new Error();

  const src = Meditate(function () {
    return Promise.reject(err);
  });

  return src.next('abc').value.then(
    function () {
      t.fail();
    },
    function (er) {
      t.eqls(er, err);
      src.end();
    }
  );
})
.should('handle error thrown in iterator', function (t) {
  const err = new Error();

  const src = Meditate(function () {
    throw err;
  });

  return src.next('abc').value.then(
    function () {
      t.fail();
    },
    function (er) {
      t.eqls(er, err);
      return src.end();
    }
  );
})
.should('errors should be passed up the pipeline', function (t) {
  const err = new Error();
  const src = Meditate(function () {
    throw err;
  });

  const dest = Meditate();
  src.write('abc');
  src.pipe(dest);

  return dest.read().then(
    function () {
      t.fail();
    },
    function (er) {
      t.eqls(er, err);
      return src.end();
    }
  );
})
.should('allow access to the ending promise before end', function (t) {
  const src = Meditate();

  src.write('abc');

  var done = src.done();
  src.end();

  return done.then(function (res) {
    t.eqls(res, ['abc']);
  });
})
.should('only stack up returned values', function (t) {
  const a = ['a', 'b', 'c', 'd', 'e'];
  const b = [];

  var resolve;
  const end = new Promise(function (res) {
    resolve = res;
  });

  const obs = Meditate(function (d) {
    if (d !== 'b' && d !== 'd')
      return d;
  }).seq();

  for (var i = 0; i < a.length; i++)
    obs.sync(a[i]);

  Meditate.Reader(obs, function (err, d) {
    if (d) {
      b.push(d);
    } else {
      resolve(b);
    }
  });

  return end.then(function (res) {
    t.equals(res.length, 3);
    t.eqls(res, ['a', 'c', 'e']);
  });
})
.should('only process promise resolutions when in `sequentialise` mode', function (t) {
  return new Promise(function (resolve) {
    const a = ['a', 'b', 'c', 'd', 'e'];

    const src = Meditate(function (d) {
      return (d !== 'b' && d !== 'd')
        ? Promise.resolve(d)
        : Promise.resolve();
    }).seq();

    for (var i = 0; i < a.length; i++) src.sync(a[i]);

    const b = [];
    Meditate.Reader(src, function (err, d) {
      d ? b.push(d) : resolve(b);
    });
  })
  .then(function (res) {
    t.eqls(res, ['a', 'c', 'e']);
  });
})
.should('handle `sequentialise` when ending element should be skipped', function (t) {
  return new Promise(function (resolve) {
    const a = ['a', 'b', 'c', 'd'];

    const src = Meditate(function (d) {
      return (d !== 'b' && d !== 'd')
        ? Promise.resolve(d)
        : Promise.resolve();
    }).seq();

    for (var i = 0; i < a.length; i++) src.sync(a[i]);

    const b = [];
    Meditate.Reader(src, function (err, d) {
      d ? b.push(d) : resolve(b);
    });
  })
  .then(function (res) {
    t.eqls(res, ['a', 'c']);
  });
})
.should('sequentialise when multiple ending elements should be skipped', function (t) {
  return new Promise(function (resolve) {
    const a = ['a', 'b', 'c', 'd', 'e', 'f'];

    const src = Meditate.Contemplate(function (d) {
      return (d === 'b' || d === 'd')
        ? Promise.resolve(d)
        : Promise.resolve();
    }).seq();

    for (var i = 0; i < a.length; i++) src.sync(a[i]);

    const b = [];
    Meditate.Reader(src, function (err, d) {
      d ? b.push(d) : resolve(b);
    });
  })
  .then(function (res) {
    t.eqls(res, ['b', 'd']);
  });
})
.should('sequentialise in correct order despite resolution', function (t) {
  return new Promise(function (end) {
    const a = ['a', 'b'];

    var resolve;
    function createResolve(res, i) {
      return function() {
        res(i);
      };
    }

    const src = Meditate.Contemplate(function (d) {
      if (d === 'a') {
        return new Promise(function (res) {
          resolve = createResolve(res, d);
        });
      } else {
        return new Promise(function (res) {
          res(d);
          process.nextTick(resolve);
        });
      }
    });

    for (var i = 0; i < a.length; i++) src.sync(a[i]);

    const b = [];
    Meditate.Reader(src, function (err, d) {
      d ? b.push(d) : end(b);
    });
  })
  .then(function (res) {
    t.eqls(res, ['a', 'b']);
  });
})
.should('sequentialise in correct order despite resolution and still flatten', function (t) {
  return new Promise(function (end) {
    const a = ['a', 'b'];

    var resolve;
    function createResolve(res, i) {
      return function() {
        res(i);
      };
    }

    const src = Meditate.Contemplate(function (d) {
      if (d === 'a') {
        return new Promise(function (res) {
          resolve = createResolve(res, undefined);
        });
      } else {
        return new Promise(function (res) {
          res(d);
          process.nextTick(resolve);
        });
      }
    });

    for (var i = 0; i < a.length; i++) src.sync(a[i]);

    const b = [];
    Meditate.Reader(src, function (err, d) {
      d ? b.push(d) : end(b);
    });
  })
  .then(function (res) {
    t.eqls(res, ['b']);
  });
});

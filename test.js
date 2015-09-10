const desc = require('macchiato');
const Promise = require('bluebird');
const Observable = require('./');

desc('meditate.Observable')
.should('push data through when pulled - this is only safe with sync or deterministic data', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  var i = 0;

  var called = false;
  const observable = Observable(function (data, push, end) {
    called = true;
    var value = a[i];
    if ((i += 1) === a.length) end();
    return value;
  });

  const b = [];
  for (var v of observable) {
    b.push(v);
  }

  return Promise.all(b).then(function (res) {
    t.eqls(res, a);
    t.assert(called);
  });
})
.should('optimistically pull data out - which is provided thereafter', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  var i = 0;

  var called = false;
  const observable = Observable(function () {
    return new Promise(function (resolve, reject) {
      process.nextTick(function () {
        called = true;
        resolve(a[i]);
        i += 1;
      });
    });
  });

  const b = [];

  for (var j = 0; j < a.length; j++) {
    b.push(observable.next().value);
  }

  return Promise.all(b).then(function (res) {
    t.eqls(res, a);
    t.assert(called);
  });
})
.should('passthrough data asynchronously if no callback is set and data is manually passed through', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = [];
  const observable = Observable();

  for (var i = 0; i < a.length; i++) {
    b.push(observable.next(a[i]).value);
  }

  observable.end();

  return Promise.all(b).then(function (res) {
    t.eqls(res, a);
  });
})
.should('call end callback passing on returned value', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();
  src.cork();

  const dest = Observable();

  src.pipe(dest);
  for (var i = 0; i < a.length; i++) src.sync(a[i]);

  const d = [];

  for (i = 0; i < a.length; i++) d.push(dest.read());

  return Promise.all(d).then(function (res) {
    t.eqls(res, a);
  });
})
.should('multiplex output when piped to other observables', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  const b = [];
  const c = [];

  const src = Observable();
  const dest1 = Observable();
  const dest2 = Observable();

  src.pipe(dest1);
  src.pipe(dest2);

  var i;
  for (i = 0; i < a.length; i++) src.next(a[i]);
  for (i = 0; i < a.length; i++) b.push(dest1.next().value);
  for (i = 0; i < a.length; i++) c.push(dest2.next().value);

  src.end();

  return Promise.all([
    Promise.all(b).then(function (res) { t.eqls(res, a); }),
    Promise.all(c).then(function (res) { t.eqls(res, a); })
  ]);
})
.should('allow corking capabilities', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();
  const b = src.cork();

  for (var i = 0; i < a.length; i++) src.next(a[i]);
  src.end();

  return b.then(function (res) { t.eqls(res, a); });
})
.should('uncork returning the corked promise', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();
  src.cork();

  for (var i = 0; i < a.length; i++) src.next(a[i]);
  const b = src.uncork();
  src.end();

  return b.then(function (res) { t.eqls(res, a); });
})
.should('return corked promise when end is called', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();
  src.cork();

  for (var i = 0; i < a.length; i++) src.next(a[i]);

  return src.end().then(function (res) { t.eqls(res, a); });
})
.should('return empty array from end if not corked', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();
  for (var i = 0; i < a.length; i++) src.next(a[i]);

  return src.end().then(function (res) { t.eqls(res, []); });
})
.should('not return values until uncorked', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();
  src.cork();

  const out = [];
  for (var i = 0; i < a.length; i++)
    t.eqls(src.next(a[i]), { value: null, done: false });

  src.uncork();

  for (i = 0; i < a.length; i++)
    out.push(src.next().value);

  src.end();

  return Promise.all(out)
    .then(function (res) { t.eqls(res, a); });
})
.should('pass on all corked values to piped dest on uncork', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();
  src.cork();

  const dest = Observable();

  src.pipe(dest);
  for (var i = 0; i < a.length; i++) src.sync(a[i]);

  const d = [];

  for (i = 0; i < a.length; i++) d.push(dest.read());

  return Promise.all(d).then(function (res) {
    t.eqls(res, a);
  });
})
.should('return flushed data from end if not read', function (t) {
  const a = ['a', 'b', 'c', 'd'];

  const src = Observable();

  for (var i = 0; i < a.length; i++) src.write(a[i]);

  return src.end().then(function (v) { t.eqls(v, a); });
})
//.should('return flushed data from end if not read', function (t) {
//  const a = ['a', 'b', 'c', 'd'];
//
//  const src = Observable(null, function (end) {
//    return end.then(function (v) {
//      console.log(v);
//      return true;
//    });
//  });
//  src.cork();
//
//  for (var i = 0; i < a.length; i++) src.next(a[i]);
//
//  return src.end().then(function (value) { t.assert(value); });
//})

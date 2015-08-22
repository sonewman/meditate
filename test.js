const desc = require('macchiato');
const Promise = require('bluebird');
const Observable = require('./lib/observable');

desc('meditate.Observable')
.it('should push data through when pulled - this is only safe with sync or deterministic data', function (t) {
  const a = ['a', 'b', 'c', 'd'];
  var i = 0;
  
  const observable = Observable(function (push, end, error) {
    push(a[i]);
    if ((i + 1) === a.length) end();
    else i += 1;
  });
  
  const b = [];

  for (var v of observable) {
    b.push(v);
  }
  
  return Promise.all(b).then(function (res) {
    t.eqls(res, a);
  });
})
.it('should take callback to next, called with data when available', {
  
});

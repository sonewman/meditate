# Meditate
[![Code Climate](https://codeclimate.com/github/sonewman/meditate/badges/gpa.svg)](https://codeclimate.com/github/sonewman/meditate)

Meditate on your streaming data with a promise!

### Install
```
# npm i -S meditate
```

### Usage
```javascript
const observable1 = Meditate();

const observable2 = Meditate(
  (data, push, next) => {
    // do something with data
    // either return a value
    // called push(data); or
    // end(data);
    // - if a value is returned this
    // value will be wrapped in a Promise
    return fetch('http://www.example.com/data.json');
  },
  endingPromise => {
    // endPromise will either resolve
    // to any unread data in the buffer
    // or an empty array
    return endPromise.then(item => item * 2);
  }
);
```

#### Use as a Readable Stream

Once an observable has been created it can be used as a iterable:

```javascript
const a = ['a', 'b', 'c', 'd'];
var i = -1;

const obs = Meditate(function (data, push, end) {
  ++i < (a.length - 1) ? push(a[i]) : end(a[i]);
});

const b = [];
for (var v of obs) b.push(v);

return Promise.all(b).then(function (res) {
  // do something with res
});
```

More documentation to come...

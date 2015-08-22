module.exports = Observable;

const Promise = require('bluebird');

function Chunk(data) {
  this.data = data;
  this.next = null;
}

function State() {
  this.top = null;
  this.tail = null;
  this.started = false;
  this.ended = false;
  this.ending = false;

  this.error = null;

  this.pendingTop = null;
  this.pendingTail = null;
}

State.prototype.push = function (value) {
  if (!value) return;
  const chunk = new Chunk(value);

  if (!this.top) {
    this.top = chunk;
    this.started = true;
  } else {
    this.tail.next = chunk;
  }

  this.tail = chunk;
};

State.prototype.end = function (value) {
  this.ending = true;
  this.push(value);
};

State.prototype.pop = function () {
  var next = this.top;
  this.top = next.next;

  if (next === this.tail) {
    if (this.ending) this.ended = true;
    this.tail = null;
  }

  return next.data;
};

function emit(pending, error, value, ended) {
  if (pending.length > 0) {
    for (var fn of pending) {
      fn(error, { value: value, done: ended });
    }
    pending.length = 0;
  }
}

function Observable(cb) {
  if (!(this instanceof Observable)) 
    return new Observable(cb);

  const state = new State();
  this._ob = Observable_(cb);
  // start
  this._ob.next();

  function * Observable_(cb) {
    var p = cb(push, end, error);

    const pending = [];
    var fn = yield;

    while (true) {
      if (fn) {
        if ('function' === typeof fn)
          pending.push(p);

        fn = null;
      }

      if (state.error) {
        yield Promise.reject(state.error);
        return;
      }

      var next = state.pop();

      if (next) {
        var promise = Promise.resolve(next);
        fn = yield promise;
      } else {
        fn = yield null;
      }

      if (state.ended) return;
      cb(push, end, error);
    }
  } 

  function push(d) {
    state.push(d);
  }

  function end(d) {
    state.end(d);
  }

  function error(err) {
    state.error = err;
  }
}

Observable.prototype.next = function (value) {
  return this._ob.next(value);
};

Object.defineProperty(Observable.prototype, Symbol.iterator, {
  get: function () {
    var self = this;

    return function * gen() {
      while (true) {
        var v = self.next();
        if (v.done) {
          return;
        } else {
          yield v.value;
        }
      }
    };
  }
});



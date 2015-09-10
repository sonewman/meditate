module.exports = Observable;

var Promise = require('bluebird');

function PromiseWrap() {}
PromiseWrap.prototype.resolve = null;
PromiseWrap.prototype.reject = null;
PromiseWrap.prototype.promise = null;

function SetNewWrapPromise(wrap) {
  wrap.promise = new Promise(function (resolve, reject) {
    wrap.resolve = resolve;
    wrap.reject = reject;
  });
  return wrap.promise;
}

PromiseWrap.prototype.getPromise = function () {
  return this.promise || SetNewWrapPromise(this);
};

PromiseWrap.prototype.update = function (value) {
  if (isPromise(value)) {

    if (this.promise) UpdatePromise(this, value);
    else this.promise = value;
    return value;

  } else {
    SetNewWrapPromise(this);
    this.resolve(value);
    return this.promise;
  }
};

function UpdatePromise(wrap, promise) {
  function success(v) {
    wrap.resolve(v);
  }

  function reject(err) {
    wrap.reject(err);
  }

  promise.then(success, reject);
}

function Chunk() { PromiseWrap.call(this); }
Chunk.prototype = Object.create(PromiseWrap.prototype, {
  constructor: { value: Chunk }
});
Chunk.prototype.next = null;

function CallStateHandle(state, cb, data) {
  function push(d) { state.push(d); }
  function end(d) { state.end(d); }
  return cb.call(state.owner, data, push, end);
}

function State(owner, opts) {
  this.owner = owner;
  this.options = opts;
  this.pipes = [];
  this.it = it(this);
  this.it.next();
  this.endPromise = new PromiseWrap();
  SetNewWrapPromise(this.endPromise);
}

State.prototype.owner = null;
State.prototype.tail = null;
State.prototype.nextPush = null;
State.prototype.nextPull = null;
State.prototype.ended = false;
State.prototype.ending = false;
State.prototype.error = null;
State.prototype.pipes = null;
State.prototype.buffer = null;
State.prototype.endPromise = null;

State.prototype.ondata = function (value) {
  if (this.buffer) {
    this.buffer.push(value);
  } else {
    for (var i = 0; i < this.pipes.length; i += 1)
      this.pipes[i].write(value);
  }
};

State.prototype.write = function (data) {
  var cb = this.options.cb;
  if ('function' !== typeof cb) return this.push(data);

  //this.scheduler.push(data);
  return this.push(CallStateHandle(this, cb, data));
};

State.prototype.addPipe = function (dest) {
  if (this.pipes.indexOf(dest) < 0) this.pipes.push(dest);
  return dest;
};

State.prototype.removePipe = function (pipe) {
  var i = this.pipes.indexOf(dest);
  if (i < 0) this.pipes.splice(i, 1);
  return pipe;
};

/**
 * @abstract
 * @param {State} state
 * @param {*} value
 * @return {boolean}
 */
State.prototype.push = function (value) {
  if (value === undefined) return;
  if (this.ended) throw new Error('data after end');
  return PushValue(this, value);
};

function PushValue(state, value) {
  if (state.nextPush !== null) {
    var chunk = state.nextPush;
    state.nextPush = state.nextPush.next;
  } else {

    var chunk = new Chunk();

    if (state.nextPull === null) {
      state.nextPull = state.tail = chunk;
    } else {
      state.tail.next = chunk;
      state.tail = chunk;
  }
  }

  chunk.update(value);
  state.ondata(chunk.promise);
  return StateIsExpectingData(state);
}

/**
 * Is State expected some data
 * @abstract
 * @param {State} state
 * @return {boolean}
 */
function StateIsExpectingData(state) {
  return state.nextPull === null
    || state.nextPush !== null
    || (state.nextPull === null && state.nextPush === null);
};


State.prototype.pop = function () {
  if (this.nextPull !== null) {
    var chunk = this.nextPull;
    this.nextPull = this.nextPull.next;

  } else {
    var chunk = new Chunk();

    if (this.nextPush === null) {
      this.nextPush = this.tail = chunk;
    } else {
      this.tail.next = chunk;
      this.tail = chunk;
    }
  }

  return WrapChunkPromise(chunk.getPromise(), this);
};

function WrapChunkPromise(promise, state) {
  return promise.catch(onerror);

  function onerror(err) {
    state.error = err;
    throw err;
  }
}

function CorkBuffer() {
 PromiseWrap.call(this);
 this.stack = [];
}

CorkBuffer.prototype = Object.create(PromiseWrap.prototype, {
  constructor: { value: CorkBuffer }
});

CorkBuffer.prototype.release = function () {
  return this.update(Promise.all(this.stack));
};

CorkBuffer.prototype.push = function (d) {
  this.stack.push(d);
};

State.prototype.cork = function () {
  if (!this.buffer) this.buffer = new CorkBuffer();
  return this.buffer.getPromise();
};

function DistributeChunk(chunk, pipe) {
  process.nextTick(function () {
    pipe.write(chunk);
  });
}

/**
 * Drain state buffer, this assumes explicitly
 * that the state has a buffer
 * @param {State} state
 */
function DrainBuffer(state, buffer, pipes) {
  for (var i = 0; i < buffer.stack.length; i += 1) {
    for (var j = 0; j < pipes.length; j += 1)
      DistributeChunk(buffer.stack[i], pipes[j]);
  }
}

State.prototype.uncork = function () {
  var cork = this.buffer;
  if (cork) {
    DrainBuffer(this, this.buffer, this.pipes);
    this.buffer = null;
    return cork.release();
  }

  return Promise.resolve([]);
};

State.prototype.sync = function (data) {
  WriteAndEndSync(this, data);
};

State.prototype.end = function (data) {
  WriteAndEndSync(this, data)
  return this.endPromise.getPromise();
};

function WriteAndEndSync(state, data) {
  if (state.ending === false) {
    state.ending = true;
    EndState(state);
  }

  state.write(data);
}

/**
 * End the given State
 * @abstract
 * @param {State} state
 * @param {*} value
 * @return {Promise}
 */
function EndState(state) {
  process.nextTick(function () {
    state.close();
  });
}

/**
 * Close the state, happens on the next tick to `end`
 * this gives time for other data to do something before
 * closing the input channel
 */
State.prototype.close = function () {
  this.ended = true;

  // call make cork actually flush to transform
  // rather than end
  var uncorked = this.options.end(this.uncork());

  for (var i = 0; i < this.pipes.length; i += 1)
    this.pipes[i].end()

  this.endPromise.update(uncorked);
};

function isPromise(p) {
  return p && 'function' === typeof p.then && 'function' === typeof p.catch;
}

function DefaultCallback(data) { return data; }

function isfn(cb) { return 'function' === typeof cb; }

function HandleArgs(args) {
  if (args[0] && 'object' === typeof args[0]) {
    this.options = args[0];
    if (isfn(args[1])) this.cb = args[1];
    if (isfn(args[2])) this.end = args[2];
  } else {
    if (isfn(args[0])) this.cb = args[0];
    if (isfn(args[1])) this.end = args[1];
  }
}

HandleArgs.prototype.options = null;
HandleArgs.prototype.cb = DefaultCallback;
HandleArgs.prototype.end = DefaultCallback;

function Observable(op, cb, onend) {
  if (!(this instanceof Observable))
    return new Observable(op, cb, onend);

  this.__state__ = new State(this, new HandleArgs(arguments));
}

Observable.prototype.next = function (d) {
  return this.__state__.it.next(d);
};

Observable.prototype.sync = function (data) {
  return this.__state__.sync(data);
};

Observable.prototype.end
= Observable.prototype.done
= function (value) {
  return this.__state__.end(value);
};

Observable.prototype.push = function (value) {
  return this.__state__.push(value);
};

Observable.prototype.pipe = function (dest) {
  return this.__state__.addPipe(dest);
};

Observable.prototype.unpipe = function (dest) {
  return this.__state__.removePipe(dest);
};

Observable.prototype.write = function (data) {
  return this.__state__.write(data);
};

function ReadState(state) {
  return state.buffer ? null : state.pop();
}

Observable.prototype.read = function () {
  return ReadState(this.__state__);
};

Observable.prototype.cork = function () {
  return this.__state__.cork();
};

Observable.prototype.uncork = function () {
  return this.__state__.uncork();
};

function * it(state) {
  const pending = [];
  var started = false;
  var output = null;
  var p;

  while (true) {
    if (!output && state.buffer === null && started)
      return;

    started = true;
    var input = yield output;

    if (!state.ending) {
      state.write(input);

      if (state.error) {
        yield Promise.reject(state.error);
        return;
      }

      output = ReadState(state);
    } else {
      output = null;
    }
  }
}

Object.defineProperty(Observable.prototype, 'ended', {
  get: function () { this.__state__.ended; }
});

Object.defineProperty(Observable.prototype, Symbol.iterator, {
  get: function () {
    var self = this;

    return function * gen() {
      while (true) {
        var v = self.next();
        if (v.done) return;
        else yield v.value;
      }
    };
  }
});

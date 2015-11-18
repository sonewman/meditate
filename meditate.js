module.exports = Meditate;

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

function UpdatePromise(wrap, promise) {
  function success(v) { wrap.resolve(v); }
  function reject(err) { wrap.reject(err); }
  promise.then(success, reject);
}

PromiseWrap.prototype.getPromise = function () {
  return this.promise || SetNewWrapPromise(this);
};

PromiseWrap.prototype._update = function (value) {
  if (isPromise(value)) {
    if (this.promise) UpdatePromise(this, value);
    else this.promise = value;

  } else {
    if (!this.promise) SetNewWrapPromise(this);
    this.resolve(value);
  }
};

PromiseWrap.prototype.update = function (value) {
  this._update(value);
  return this.promise;
};

function State(owner, opts) {
  this.owner = owner;
  this.options = opts;
  this.buffer = [];
  this.pipes = [];
  this.srcs = [];
  this.it = it(this);
  this.it.next();
  this.corks = 0;
  this.pending = 0;
  this.ending = false;
  this.ended = false;
  this.syncEnding = false;
  this.flushedEnd = false;

  this.ticketList = new TicketList(this);
  this.pendingList = new PendingList();
}

State.prototype.owner = null;
State.prototype.ended = false;
State.prototype.ending = false;
State.prototype.syncEnding = false;
State.prototype.flushedEnd = false;

State.prototype.error = null;
State.prototype.pipes = null;
State.prototype.srcs = null;
State.prototype.buffer = null;
State.prototype.endPromise = null;

State.prototype.isCorked = false;
State.prototype.corked = 0;
State.prototype.pending = 0;
State.prototype.pendingPipeDrain = false;
State.prototype.deferEnd = 0;
State.prototype.ticketList = null;
State.prototype.pendingList = null;
State.prototype.seqResolve = false;

function CallHandle(ctx, cb, data, push, end) {
  try {
    return cb.call(ctx, data, push, end);
  } catch (err) {
    return Promise.reject(err);
  }
}

function CallStateHandle(state, cb, data) {
  function push(d) { state.push(d); }
  function end(d) {
    if (d !== undefined) state.push(d);
    state.end();
  }
  return CallHandle(state.owner, cb, data, push, end);
}

function PushWriteChunk(state, data) {
  var cb = state.options.cb;
  if ('function' !== typeof cb) return state.push(data);
  return state.push(CallStateHandle(state, cb, data));
}

State.prototype.write = function (data) {
  if (this.isCorked) {
    this.buffer.push(data);
    this.corked += 1;
  } else {
    return PushWriteChunk(this, data);
  }
};

function OnData(owner, pipes, value) {
  if ('function' === typeof owner.ondata)
    owner.ondata(value);

  WriteToPipes(pipes, value);
}

function WriteToPipes(pipes, value) {
  for (var i = 0; i < pipes.length; i += 1)
    pipes[i].write(value);
}

function CreateFlush(state) {
  return function () {
    while (state.pending > 0) state.pop();
    state.pendingPipeDrain = false;
  };
}

function FlushBufferToPipes(state) {
  if (state.pendingPipeDrain) return;
  state.pendingPipeDrain = true;
  state.deferEnd += 1;
  Promise.resolve().then(CreateFlush(state));
}

State.prototype.addPipe = function (dest) {
  if (this.pipes.indexOf(dest) < 0) {
    this.pipes.push(dest);

    if ('function' === typeof dest.src) {
      dest.src(this.owner);
    }

    if (!this.pendingPipeDrain)
      FlushBufferToPipes(this);
  }
  return dest;
};

State.prototype.addSrc = function (src) {
  this.srcs.push(src);
};

State.prototype.removePipe = function (pipe) {
  var i = this.pipes.indexOf(pipe);
  if (i < 0) this.pipes.splice(i, 1);
  return pipe;
};

var c = -1;
function Chunk(value) {
  this.value = value;
  this.i = ++c;
}
Chunk.prototype.next = null;
Chunk.prototype.value = null;

function PendingList() {
  this.head = null;
  this.tail = null;
  this.pending = 0;
}

PendingList.prototype.push = function (chunk) {
  this.pending += 1;

  if (!this.head) {
    this.head = this.tail = chunk;
  } else {
    this.tail.next = chunk;
    this.tail = chunk;
  }
};

PendingList.prototype.pop = function () {
  var head = this.head;
  if (head) {
    this.head = this.head.next;

    if (!this.head) {
      this.tail = null;
    }

    this.pending -= 1;
    return head;
  }
};

function PushValue(state, value) {
  var chunk = new Chunk(value);
  state.pending += 1;

  if (state.ticketList.head) {
    state.ticketList.update(chunk);
  } else {
    state.pendingList.push(chunk);
  }
}

State.prototype.push = function (value) {
  if (value === undefined) return;
  return PushValue(this, value);
};

State.prototype.read = function () {
  // TODO make read pull from src
};

var i = -1;
function Ticket() {
  this.i = ++i;
  var self = this;
  self.promise = new Promise(function (res, rej) {
    self.resolve = res;
    self.reject = rej;
  });
}

Ticket.prototype.next = null;
Ticket.prototype.resolve = null;
Ticket.prototype.reject = null;
Ticket.prototype.promise = null;

function TicketList(state) {
  this.state = state;
  this.head = null;
  this.tail = null;
}

TicketList.prototype.newTicket = function () {
  var ticket = new Ticket();

  if (!this.head) {
    this.head = this.tail = ticket;
  } else {
    this.tail.next = ticket;
    this.tail = ticket;
  }

  return ticket;
};

TicketList.prototype.update = function (chunk) {
  var head = this.head;
  if (!head) return;

  var next = head.next;

  // decrease pending count
  this.state.pending -= 1;

  OnData(this.state.owner, this.state.pipes, chunk.value);
  head.resolve(chunk.value);
  this.head = next;
};

function ResolveValue(state, chunk) {
  if (isPromise(chunk.value)) {
    chunk.value.then(function (value) {
      ResolveValue(state, new Chunk(value));
    });

  } else if (chunk.value !== undefined) {
    state.ticketList.update(chunk);
  } else {
    state.pending -= 1;
    UpdateOnPop(state);
  }
}

function UpdateOnPop(state) {
  if (state.pendingList.head) {
    var chunk = state.pendingList.pop();

    if (chunk) {

      if (state.seqResolve)
        ResolveValue(state, chunk);
      else
        state.ticketList.update(chunk);
    }
  } else {

    if (state.ended && state.pending <= 0)
      state.ticketList.update(new Chunk());
  }
}

function PopState(state) {
  if (state.ended && state.pending <= 0)
    return Promise.resolve(null);

  var ticket = state.ticketList.newTicket();

  var wrappedPromise = WrapChunkPromise(ticket.promise, state);
  UpdateOnPop(state);
  return wrappedPromise;
}

State.prototype.pop = function () {
  return PopState(this);
};

function WrapChunkPromise(promise, state) {
  return promise.catch(onerror);

  function onerror(err) {
    state.error = err;
    throw err;
  }
}

State.prototype.cork = function () {
  if (!this.isCorked) this.isCorked = true;
};

/**
 * Drain state buffer, this assumes explicitly
 * that the state has a buffer
 * @param {State} state
 */
function DrainBuffer(state, buffer) {
  for (var i = 0; i < buffer.length; i += 1) {
    state.corked -= 1;
    PushWriteChunk(state, buffer[i]);
  }

  buffer.length = 0;
}

State.prototype.uncork = function () {
  this.isCorked = false;

  if (this.buffer.length > 0)
    DrainBuffer(this, this.buffer);
};

State.prototype.sync = function (data) {
  if (this.ended) throw new Error('data after end');

  if (this.ending === false && this.syncEnding === false) {
    this.syncEnding = true;
    TriggerEndState(this);
  }

  return this.write(data);
};

State.prototype.seq = function () {
  this.seqResolve = true;
};

State.prototype.unseq = function () {
  this.seqResolve = false;
};

function CreateEndPromise(state) {
  if (!state.endPromise)
    state.endPromise = new PromiseWrap();

  if (state.ended) FlushEnd(state);

  return state.endPromise.getPromise();
}

State.prototype.end = function (data) {
  if (this.ended) {
    if (data !== undefined)
      throw new Error('data after end');
    else
      return;
  }

  if (this.ending === false && this.syncEnding === false)
    TriggerEndState(this);

  this.ending = true;

  if (data !== undefined) this.write(data);

  return CreateEndPromise(this);
};

State.prototype.done = function () {
  return CreateEndPromise(this);
};

/**
 * End the given State
 * @abstract
 * @param {State} state
 * @param {*} value
 * @return {Promise}
 */
function TriggerEndState(state) {
  Promise.resolve().then(function () {
    EndState(state);
  });
}

function EndState(state) {
  // uncork to flush all corked data through
  state.uncork();

  if (state.deferEnd > 0) {
    state.deferEnd -= 1;
    TriggerEndState(state);
  } else {
    // set state ending if not already
    state.ending = true;
    state.close();
  }
}

function FlushEnd(state) {
  if (!state.flushedEnd) {
    state.flushedEnd = true;
    state.endPromise.update(
      state.options.end(Promise.all(state.flush()))
    );
  }
}

/**
 * Close the state, happens on the next tick to `end`
 * this gives time for other data to do something before
 * closing the input channel
 */
State.prototype.close = function () {
  this.ended = true;

  // TODO put this in next tick perhaps?
  for (var i = 0; i < this.pipes.length; i += 1)
    this.pipes[i].end();

  // if a demand has been made for this promise already
  // fulfill it immediately
  if (this.endPromise) FlushEnd(this);
};

State.prototype.flush = function () {
  var data = [];

  while ((this.pending + this.corked) > 0)
    data.push(this.pop());

  return data;
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

function Meditate(op, cb, onend) {
  if (!(this instanceof Meditate))
    return new Meditate(op, cb, onend);

  this.__state__ = new State(this, new HandleArgs(arguments));
}

function Contemplate(op, cb, onend) {
  if (!(this instanceof Contemplate))
    return new Contemplate(op, cb, onend);

  Meditate.call(this, op, cb, onend);
  this.__state__.seqResolve = true;
}

Contemplate.prototype = Object.create(Meditate.prototype, {
  constructor: { value: Contemplate }
});

Meditate.Contemplate = Contemplate;

Meditate.Reader = Reader;

function Reader(obs, fn) {
  if (!(this instanceof Reader))
    return new Reader(obs, fn);

  it();

  function ondata(i) {
    fn(null, i);
    if (i != null) it();
  }

  function it() {
    obs.read().then(ondata, fn);
  }
}

function noop() {}

// FIXME Below API is a hack to allow Node Streams
// to be piped into these streams.
//
// TODO remove below and create a stream adapter
Meditate.prototype.on
= Meditate.prototype.once
= Meditate.prototype.emit
= Meditate.prototype.removeListener
= noop;

// method can be overwritten to be called
// with data after leaving transform
Meditate.prototype.ondata = null;

Meditate.prototype.next = function (d) {
  return this.__state__.it.next(d);
};

Meditate.prototype.sync = function (data) {
  return this.__state__.sync(data);
};

Meditate.prototype.end = function (value) {
  return this.__state__.end(value);
};

Meditate.prototype.done = function () {
  return this.__state__.done();
};

Meditate.prototype.push = function (value) {
  return this.__state__.push(value);
};

function ArrayOfPipes(state, pipes) {
  for (var i = 0; i < pipes.length; i += 1)
    state.addPipe(pipes[i]);

  return pipes;
}

Meditate.prototype.pipe = function (dest) {
  if (Array.isArray(dest))
    return ArrayOfPipes(this.__state__, dest);

  return this.__state__.addPipe(dest);
};

// add a source (reverse pipe)
Meditate.prototype.src = function (src) {
  this.__state__.addSrc(src);
  return this;
};

Meditate.prototype.unpipe = function (dest) {
  return this.__state__.removePipe(dest);
};

Meditate.prototype.write = function (data) {
  return this.__state__.write(data);
};

Meditate.prototype.read = function () {
  return this.__state__.pop();
};

Meditate.prototype.cork = function () {
  this.__state__.cork();
  return this;
};

Meditate.prototype.uncork = function () {
  this.__state__.uncork();
  return this;
};

Meditate.prototype.seq
= Meditate.prototype.sequentialise
= function () {
  this.__state__.seq();
  return this;
};

Meditate.prototype.unseq
= Meditate.prototype.unsequentialise
= Meditate.prototype.throttle
= function () {
  this.__state__.unseq();
  return this;
};

function MaybeReadState(state) {
  return state.isCorked ? null : state.pop();
}

function EndIterator(output, state, started) {
  return !output
    && ((state.buffer.length === 0
        && started)
        || state.ending);
}

function* it(state) {
  var started = false;
  var output = null;

  while (true) {
    if (EndIterator(output, state, started))
      return;

    started = true;
    var input = yield output;

    if (!state.ending) {
      state.sync(input);

      if (state.error) {
        yield Promise.reject(state.error);
        return;
      }

      output = MaybeReadState(state);
    } else {
      output = null;
    }
  }
}

Object.defineProperty(Meditate.prototype, 'ended', {
  get: function () { this.__state__.ended; }
});

Object.defineProperty(Meditate.prototype, Symbol.iterator, {
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

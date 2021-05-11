const a = [ 1, 2, 3, 4 ,5 ];


async function* fn(x) {
  while (x.length) {
    yield x.shift();
  }

  return true;
}


function iter(x) {
  const it = {
    async next() {
      return { value: x.shift(), done: x.length === 0 };
    },
//    return() {},
//    throw() {},
    [Symbol.iterator]() {
      return it;
    },

    [Symbol.asyncIterator]() {
      return it;
    }
  };

  //it.__proto__ = Gen();

  return it;
}


function* abc() {}

//console.log(abc());

//for await (const c of fn(a)) {
//  console.log(c);
//}

const p = [];

const f = iter(a);

for await (const n of f) {
  p.push(n);
}

console.log(p);



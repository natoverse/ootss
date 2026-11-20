const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validate, encode, decode, Sync } = require('../js/settings_sync.js');

const settings = () => ({
  fogOfWar: true,
  revealedScreens: { 'O+00+00': true, 'OH-02+03': false },
  markedItems: { puzzle: true },
  activeLayers: { overworld: true, grid: true },
  center: [69, 80],
  zoom: 3,
});
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
};

test('Firestore values round-trip the full settings JSON using Stronger string-value conventions', () => {
  const original = settings();
  assert.deepEqual(decode(encode(original)), original);
  assert.ok(Object.values(encode(original)).every(value => typeof value === 'string'));
});

test('invalid imported or cloud settings fail instead of resetting progress', () => {
  assert.throws(() => validate([]), /JSON object/);
  assert.throws(() => validate({ markedItems: { puzzle: 'true' } }), /boolean/);
  assert.throws(() => validate({ center: [NaN, 0] }), /coordinates/);
  assert.throws(() => decode({ fogOfWar: true }), /Invalid cloud setting/);
  assert.throws(() => decode({ fogOfWar: 'not-json' }), SyntaxError);
});

test('bursty edits coalesce into one immutable latest snapshot', async () => {
  const writes = [];
  const sync = new Sync({ write: async values => writes.push(values), onStatus() {}, delay: 60000 });
  const data = settings();
  sync.save(data);
  data.zoom = 5;
  sync.save(data);
  data.markedItems.puzzle = false;
  await sync.flush();
  assert.equal(writes.length, 1);
  assert.equal(decode(writes[0]).zoom, 5);
  assert.equal(decode(writes[0]).markedItems.puzzle, true);
  assert.deepEqual(sync.status().error, null);
  assert.equal(sync.status().dirty, false);
});

test('additional edits enqueue even when an earlier offline write awaits acknowledgment', async () => {
  const requests = [];
  const sync = new Sync({
    write(values) {
      const request = { ...deferred(), values };
      requests.push(request);
      return request.promise;
    },
    onStatus() {},
    delay: 60000,
  });
  const data = settings();
  sync.save(data);
  sync.send();
  await tick();
  data.zoom = 6;
  sync.save(data);
  const flushing = sync.flush();
  await tick();
  assert.equal(requests.length, 2);
  assert.equal(decode(requests[0].values).zoom, 3);
  assert.equal(decode(requests[1].values).zoom, 6);
  requests[1].resolve();
  await tick();
  requests[0].reject(new Error('Earlier write failed'));
  await flushing;
  assert.equal(sync.status().dirty, false);
  assert.equal(sync.status().error, null);
});

test('failed writes retain the latest draft and can be retried explicitly', async () => {
  let fail = true;
  const sync = new Sync({
    write: async () => { if (fail) throw new Error('Permission denied'); },
    onStatus() {},
    delay: 60000,
  });
  sync.save(settings());
  await assert.rejects(sync.flush(), /Permission denied/);
  assert.equal(sync.status().dirty, true);
  assert.equal(sync.status().pending, 0);
  fail = false;
  sync.retry();
  await sync.flush();
  assert.equal(sync.status().dirty, false);
  assert.equal(sync.status().error, null);
});

test('an unchanged restored profile does not generate a Firestore write', async () => {
  let writes = 0;
  const sync = new Sync({ initial: settings(), write: async () => { writes++; }, onStatus() {} });
  sync.save(settings());
  await sync.flush();
  assert.equal(writes, 0);
});

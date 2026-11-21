const assert = require('node:assert/strict');
const { test } = require('node:test');

test('messaging queries are bounded and paginated; posting atomically updates the cell chit', async () => {
  const { createMessageClient } = await import('../js/message_client.mjs');
  const queries = [];
  const writes = [];
  const sdk = {
    collection: (_, ...path) => ({ path: path.join('/') }),
    collectionGroup: (_, name) => ({ group: name }),
    where: (...args) => ({ where: args }),
    orderBy: (...args) => ({ orderBy: args }),
    limit: count => {
      assert.ok(count <= 10000, 'Firestore rejects query limits above 10,000');
      return { limit: count };
    },
    startAfter: cursor => ({ cursor }),
    query: (source, ...constraints) => ({ source, constraints }),
    onSnapshot(query) { queries.push(query); return () => {}; },
    getDocsFromServer(query) { queries.push(query); return { docs: [], metadata: { fromCache: false } }; },
    doc(source, ...path) {
      return path.length ? { path: path.join('/') } : { id: 'new-message', path: `${source.path}/new-message` };
    },
    serverTimestamp: () => 'server-time',
    writeBatch: () => ({
      set: (reference, data) => writes.push({ reference, data }),
      commit: async () => {},
    }),
    waitForPendingWrites: async () => {},
  };
  const client = createMessageClient({}, { currentUser: { uid: 'player-uid', displayName: 'Player' } }, sdk);
  const unsubscribe = client.listen('all', () => {}, () => {});
  assert.equal(typeof unsubscribe, 'function');
  assert.deepEqual(queries[0].source, { group: 'boardMessages' });
  assert.deepEqual(queries[0].constraints, [{ where: ['kind', '==', 'cell'] }, { orderBy: ['createdAt', 'desc'] }, { limit: 50 }]);
  await client.older('O+00+00JG', 'last-document');
  assert.equal(queries[1].source.path, 'boards/O+00+00JG/boardMessages');
  assert.deepEqual(queries[1].constraints[1], { cursor: 'last-document' });
  client.listenCells('OH', () => {}, () => {});
  assert.deepEqual(queries[2].constraints, [{ where: ['mapPrefix', '==', 'OH'] }, { limit: 10000 }]);
  await client.send('O+00+00JG', '  A hint?  ');
  assert.equal(writes[0].data.text, 'A hint?');
  assert.equal(writes[0].data.authorUid, 'player-uid');
  assert.equal(writes[0].data.authorName, 'Player');
  assert.equal(writes[0].data.createdAt, 'server-time');
  assert.equal(writes[1].reference.path, 'boards/O+00+00JG');
  assert.deepEqual(writes[1].data, { kind: 'cell', mapPrefix: 'O', lastMessageId: 'new-message', updatedAt: 'server-time' });
  await assert.rejects(client.send('general', '   '), /1 to 4,000/);
  await assert.rejects(client.send('general', 'x'.repeat(4001)), /1 to 4,000/);
});

test('a full directory reports its limit instead of silently omitting discussion markers', async () => {
  const { createMessageClient } = await import('../js/message_client.mjs');
  let updated = false;
  let failure;
  const sdk = {
    collection: () => ({}), where: () => ({}), limit: () => ({}), query: () => ({}),
    onSnapshot(query, callback) {
      callback({ docs: Array.from({ length: 10000 }, (_, id) => ({ id: String(id) })) });
      return () => {};
    },
  };
  createMessageClient({}, {}, sdk).listenCells('O', () => { updated = true; }, error => { failure = error; });
  assert.equal(updated, false);
  assert.match(failure.message, /directory reached its display limit/);
});

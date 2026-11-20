const assert = require('node:assert/strict');
const { test } = require('node:test');

test('Shared message rules bind authors, timestamps and cell summaries without exposing profiles', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST,
}, async t => {
  function emulator(host) {
    const url = new URL(`http://${host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Use loopback emulators, never a live project.');
    return url.origin;
  }
  const auth = emulator(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const firestore = emulator(process.env.FIRESTORE_EMULATOR_HOST);
  const root = `${firestore}/v1/projects/demo-ootss/databases/(default)/documents`;
  const nameRoot = 'projects/demo-ootss/databases/(default)/documents';
  async function account(email, name) {
    const signup = await fetch(`${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'emulator-test-only', returnSecureToken: true }),
    });
    assert.equal(signup.status, 200);
    const user = await signup.json();
    const update = await fetch(`${auth}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: user.idToken, displayName: name, returnSecureToken: true }),
    });
    assert.equal(update.status, 200);
    return { ...user, ...(await update.json()), name };
  }
  const owner = await account('board-owner@example.test', 'Board Owner');
  const other = await account('board-other@example.test', 'Board Other');
  const fields = data => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { stringValue: value }]));
  async function request(path, method, user, body) {
    return fetch(`${root}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  let sequence = 0;
  function post(user, boardId, overrides = {}, options = {}) {
    const id = `message-${++sequence}`;
    const data = {
      boardId, kind: boardId === 'general' ? 'general' : 'cell',
      authorUid: user.localId, authorName: user.name, text: 'A message', ...overrides,
    };
    const writes = [{
      update: { name: `${nameRoot}/boards/${boardId}/boardMessages/${id}`, fields: fields(data) },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    }, {
      update: { name: `${nameRoot}/boards/${boardId}`, fields: fields({
        kind: boardId === 'general' ? 'general' : 'cell',
        mapPrefix: boardId === 'general' ? '' : boardId.match(/^[A-Z]+/)[0],
        lastMessageId: id,
      }) },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    }];
    return request(':commit', 'POST', options.anonymous ? null : user, { writes: options.orphan ? writes.slice(0, 1) : writes });
  }
  await t.test('authenticated users share cell discussions and general chat', async () => {
    const first = await post(owner, 'O+00+00JG');
    assert.equal(first.status, 200, await first.text());
    assert.equal((await request('/boards/O+00+00JG/boardMessages/message-1', 'GET', other)).status, 200);
    assert.equal((await post(other, 'O+00+00JG')).status, 200);
    assert.equal((await post(other, 'general')).status, 200);
    assert.equal((await request('/boards/O+00+00JG', 'GET', other)).status, 200);
  });
  await t.test('anonymous reads and writes are denied', async () => {
    assert.equal((await request('/boards/O+00+00JG/boardMessages/message-1', 'GET', null)).status, 403);
    assert.equal((await request('/boards/O+00+00JG', 'GET', null)).status, 403);
    assert.equal((await post(owner, 'O+00+00JG', {}, { anonymous: true })).status, 403);
  });
  await t.test('spoofed authors, invalid bodies, invalid addresses and orphan posts are denied', async () => {
    for (const override of [{ authorUid: other.localId }, { authorName: other.name }, { text: ' ' }, { text: 'x'.repeat(4001) }, { extra: 'not allowed' }]) {
      assert.equal((await post(owner, 'O+00+00JG', override)).status, 403);
    }
    for (const boardId of ['O+99+99AA', 'O-00+00AA', 'I+00+15AA', 'S+00+03AF', 'M+00+00FA']) {
      assert.equal((await post(owner, boardId)).status, 403, boardId);
    }
    assert.equal((await post(owner, 'O+00+00JG', {}, { orphan: true })).status, 403);
    assert.equal((await request('/boards/O+00+00JG', 'PATCH', owner, {
      fields: fields({ kind: 'cell', mapPrefix: 'O', lastMessageId: 'message-1' }),
    })).status, 403);
  });
  await t.test('messages are append-only, even for their own author', async () => {
    for (const user of [owner, other]) {
      assert.equal((await request('/boards/O+00+00JG/boardMessages/message-1', 'PATCH', user, { fields: fields({ text: 'changed' }) })).status, 403);
      assert.equal((await request('/boards/O+00+00JG/boardMessages/message-1', 'DELETE', user)).status, 403);
    }
  });
  await t.test('latest and cell-marker queries work but unbounded feeds are denied', async () => {
    const query = limit => ({
      structuredQuery: {
        from: [{ collectionId: 'boardMessages', allDescendants: true }],
        where: { fieldFilter: { field: { fieldPath: 'kind' }, op: 'EQUAL', value: { stringValue: 'cell' } } },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit,
      },
    });
    assert.equal((await request(':runQuery', 'POST', other, query(50))).status, 200);
    assert.equal((await request(':runQuery', 'POST', other, query(51))).status, 403);
    assert.equal((await request(':runQuery', 'POST', other, {
      structuredQuery: {
        from: [{ collectionId: 'boards' }],
        where: { fieldFilter: { field: { fieldPath: 'mapPrefix' }, op: 'EQUAL', value: { stringValue: 'O' } } },
        limit: 30000,
      },
    })).status, 200);
  });
});

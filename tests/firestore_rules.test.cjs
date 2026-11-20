const assert = require('node:assert/strict');
const { test } = require('node:test');

test('Firestore settings rules isolate authenticated users and validate writes', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST,
}, async t => {
  function emulator(host) {
    const url = new URL(`http://${host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Rules tests must use a loopback emulator, never a live Firebase project.');
    }
    return url.origin;
  }
  const auth = emulator(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const firestore = emulator(process.env.FIRESTORE_EMULATOR_HOST);
  async function account(email) {
    const response = await fetch(`${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'emulator-test-only', returnSecureToken: true }),
    });
    assert.equal(response.status, 200);
    return response.json();
  }
  const owner = await account('owner@example.test');
  const other = await account('other@example.test');
  const path = `users/${owner.localId}/settings/ootss`;
  const valid = {
    fields: {
      values: { mapValue: { fields: { fogOfWar: { stringValue: 'true' } } } },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };
  function request(method, token, body, document = path) {
    return fetch(`${firestore}/v1/projects/demo-ootss/databases/(default)/documents/${document}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  await t.test('the owner can create and read settings', async () => {
    assert.equal((await request('PATCH', owner.idToken, valid)).status, 200);
    assert.equal((await request('GET', owner.idToken)).status, 200);
  });
  await t.test('another authenticated user cannot read, change, or delete settings', async () => {
    assert.equal((await request('GET', other.idToken)).status, 403);
    assert.equal((await request('PATCH', other.idToken, valid)).status, 403);
    assert.equal((await request('DELETE', other.idToken)).status, 403);
  });
  await t.test('anonymous access is denied', async () => {
    assert.equal((await request('GET', null)).status, 403);
    assert.equal((await request('PATCH', null, valid)).status, 403);
  });
  await t.test('invalid document structure is rejected without replacing saved data', async () => {
    assert.equal((await request('PATCH', owner.idToken, { fields: { values: { stringValue: 'invalid' } } })).status, 403);
    const response = await request('GET', owner.idToken);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).fields.values, valid.fields.values);
  });
  await t.test('unrelated database paths are denied even to the authenticated owner', async () => {
    assert.equal((await request('PATCH', owner.idToken, valid, `users/${owner.localId}/settings/other`)).status, 403);
    assert.equal((await request('PATCH', owner.idToken, valid, 'shared/settings')).status, 403);
  });
});

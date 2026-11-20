const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const SettingsStorage = require('../js/settings_sync.js');

function fixture(settings, initial = settings, write = async () => {}) {
  const elements = new Map();
  let reloads = 0;
  let guestReads = 0;
  let loaded;
  const guest = { markedItems: { guestOnly: true } };
  const context = vm.createContext({
    SettingsStorage, setTimeout, clearTimeout,
    navigator: { onLine: true },
    console: { error() {} },
    window: { addEventListener() {} },
    location: { reload() { reloads++; } },
    localStorage: {
      getItem() { guestReads++; return JSON.stringify(guest); },
    },
    document: {
      addEventListener() {},
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { addEventListener() {}, classList: { toggle() {} } });
        return elements.get(id);
      },
    },
  });
  const Account = vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/firebase_session.js'), 'utf8') + '\nSettingsAccount.Account;', context);
  const account = new Account({
    key: 'guest-save',
    config: {},
    getSettings: () => settings,
    onReady(data) { loaded = data; },
    exportSettings() {},
  });
  account.user = { uid: 'cloud-a' };
  account.started = true;
  account.sync = new SettingsStorage.Sync({ initial, write, onStatus: () => account.render() });
  return {
    account, elements,
    reloads: () => reloads,
    guestReads: () => guestReads,
    loaded: () => loaded,
  };
}

test('cloud replacement reloads exactly once after its write is acknowledged', async () => {
  const writes = [];
  const f = fixture({ markedItems: { imported: true } }, {}, async values => writes.push(values));
  await f.account.replace();
  assert.equal(f.reloads(), 1);
  assert.deepEqual(writes, [{ markedItems: '{"imported":true}' }]);
});

test('importing unchanged cloud settings still reloads without another write', async () => {
  const writes = [];
  const f = fixture({ fogOfWar: true }, undefined, async values => writes.push(values));
  await f.account.replace();
  assert.equal(f.reloads(), 1);
  assert.deepEqual(writes, []);
});

test('replacement failure retains the draft and retry reloads only after persistence', async () => {
  let fail = true;
  const f = fixture({ markedItems: { retained: true } }, {}, async () => {
    if (fail) throw new Error('permission-denied');
  });
  await assert.rejects(f.account.replace(), /permission-denied/);
  assert.equal(f.reloads(), 0);
  assert.match(f.elements.get('account-message').textContent, /permission-denied/);
  assert.equal(f.elements.get('account-export').hidden, false);
  fail = false;
  f.account.sync.retry();
  await f.account.sync.flush();
  assert.equal(f.reloads(), 1);
  assert.equal(f.account.sync.status().dirty, false);
});

test('a cloud profile never reads guest data and queued writes retain the original UID', async () => {
  const f = fixture({});
  const writes = [];
  f.account.started = false;
  f.account.sync = null;
  f.account.client = {
    read: async () => ({ markedItems: { cloudOnly: true } }),
    write: async (uid, values) => writes.push({ uid, values }),
  };
  await f.account.connect({ uid: 'cloud-a' });
  assert.equal(f.guestReads(), 0);
  assert.deepEqual(f.loaded(), { markedItems: { cloudOnly: true } });
  f.account.sync.save({ markedItems: { changed: true } });
  await f.account.connect({ uid: 'cloud-b' });
  await f.account.sync.flush();
  assert.equal(f.reloads(), 1);
  assert.deepEqual(writes, [{ uid: 'cloud-a', values: { markedItems: '{"changed":true}' } }]);
});

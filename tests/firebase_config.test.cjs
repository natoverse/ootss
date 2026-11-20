const assert = require('node:assert/strict');
const { test } = require('node:test');
const { configuration } = require('../scripts/configure-firebase.cjs');

const env = {
  VITE_FIREBASE_API_KEY: 'example-public-web-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'ootss-example.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'ootss-example',
  VITE_FIREBASE_STORAGE_BUCKET: 'ootss-example.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_APP_ID: '1:123456789:web:example',
};

test('absent configuration explicitly leaves Firebase disabled during setup', () => {
  assert.equal(configuration({}), null);
});

test('partial configuration fails rather than publishing a broken Firebase client', () => {
  assert.throws(() => configuration({ VITE_FIREBASE_API_KEY: 'present' }), /VITE_FIREBASE_PROJECT_ID/);
});

test('the generated web configuration uses Stronger secret names and excludes administrative credentials', () => {
  assert.deepEqual(configuration({ ...env, FIREBASE_SERVICE_ACCOUNT_KEY: 'must-not-be-published' }), {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
});

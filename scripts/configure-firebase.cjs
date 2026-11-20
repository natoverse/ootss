const fs = require('node:fs');

const fields = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

function configuration(env) {
  const configured = Object.values(fields).filter(name => env[name]?.trim());
  if (configured.length === 0) return null;
  const missing = Object.values(fields).filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Incomplete Firebase configuration: ${missing.join(', ')}`);
  return Object.fromEntries(Object.entries(fields).map(([field, name]) => [field, env[name].trim()]));
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) throw new Error('Provide the generated Firebase configuration file path.');
  fs.writeFileSync(target, `window.OotssFirebaseConfig = ${JSON.stringify(configuration(process.env), null, 2)};\n`);
}

module.exports = { configuration };

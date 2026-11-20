import { createMessageClient } from './message_client.mjs';

export async function createFirebaseClient(config, decodeSettings) {
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'),
  ]);
  const app = appSdk.initializeApp(config);
  const auth = authSdk.initializeAuth(app, {
    persistence: [
      authSdk.indexedDBLocalPersistence,
      authSdk.browserLocalPersistence,
      authSdk.browserSessionPersistence,
    ],
    popupRedirectResolver: authSdk.browserPopupRedirectResolver,
  });
  const provider = new authSdk.GoogleAuthProvider();
  const db = firestoreSdk.initializeFirestore(app, {
    localCache: firestoreSdk.persistentLocalCache({
      tabManager: firestoreSdk.persistentMultipleTabManager(),
    }),
  });
  const settingsDocument = uid => firestoreSdk.doc(db, 'users', uid, 'settings', 'ootss');

  return {
    messages: createMessageClient(db, auth, firestoreSdk),
    observeAuth: (callback, onError) => authSdk.onAuthStateChanged(auth, callback, onError),
    signIn: () => authSdk.signInWithPopup(auth, provider),
    signOut: () => authSdk.signOut(auth),
    async read(uid) {
      const snapshot = await firestoreSdk.getDoc(settingsDocument(uid));
      if (!snapshot.exists()) {
        if (snapshot.metadata.fromCache) throw new Error('No cached cloud settings are available. Connect to the internet and retry.');
        return null;
      }
      return decodeSettings(snapshot.data().values);
    },
    write: (uid, values) => firestoreSdk.setDoc(settingsDocument(uid), {
      values,
      updatedAt: firestoreSdk.serverTimestamp(),
    }),
  };
}

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { firebaseSettings } from './firebase-config.mjs';

export const settings = firebaseSettings(import.meta.env);
let backend: ReturnType<typeof initializeBackend> | undefined;

function initializeBackend() {
  const app = initializeApp(settings.config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  const storage = getStorage(app);
  const functions = getFunctions(app, 'europe-west1');
  if (settings.emulator) {
    if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) {
      throw new Error('E2E builds may only run on localhost.');
    }
    connectAuthEmulator(auth, 'http://127.0.0.1:9299', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8280);
    connectStorageEmulator(storage, '127.0.0.1', 9290);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return { auth, db, storage, functions };
}

export function getBackend() {
  return backend ??= initializeBackend();
}

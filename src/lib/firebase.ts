import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { firebaseSettings } from './firebase-config.mjs';

export const settings = firebaseSettings(import.meta.env);
let backend: ReturnType<typeof initializeBackend> | undefined;

function initializeBackend() {
  const app = initializeApp(settings.config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  if (settings.emulator) {
    if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) {
      throw new Error('E2E builds may only run on localhost.');
    }
    connectAuthEmulator(auth, 'http://127.0.0.1:9299', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8280);
    connectStorageEmulator(storage, '127.0.0.1', 9290);
  }
  return { auth, db, storage };
}

export function getBackend() {
  return backend ??= initializeBackend();
}

export function observeUser(next: (user: User | null) => void, error: (error: Error) => void) {
  return onAuthStateChanged(getBackend().auth, next, error);
}

export function login() {
  // Invoke synchronously from the click to retain the browser's popup permission.
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(getBackend().auth, provider);
}

export function logout() {
  return signOut(getBackend().auth);
}

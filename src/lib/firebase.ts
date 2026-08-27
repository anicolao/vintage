import { browser } from '$app/environment';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'preview-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'vintage-e2e.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'vintage-e2e',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:123456789:web:vintage'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

let emulatorsConnected = false;

export async function connectBackend(): Promise<'emulator' | 'preview'> {
  if (!browser) return 'preview';

  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && !emulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9299', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8280);
    emulatorsConnected = true;
  }

  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    await getDoc(doc(db, 'system', 'readiness'));
    return 'emulator';
  }

  return 'preview';
}

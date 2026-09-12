import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { getBackend } from '../firebase';
export function observeUser(next: (user: User | null) => void, error: (error: Error) => void) {
  return onAuthStateChanged(getBackend().auth, next, error);
}
export function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(getBackend().auth, provider);
}
export function logout() { return signOut(getBackend().auth); }
export function explain(cause: unknown) {
  const code = (cause as { code?: string })?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled. Try again when you’re ready.';
  if (code === 'auth/popup-blocked') return 'Allow popups for Vintage, then try signing in again.';
  if (code === 'auth/unauthorized-domain') return 'Sign-in is not configured for this preview address yet.';
  return 'We couldn’t connect. Check your connection and retry.';
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { firebaseSettings } from '../../src/lib/firebase-config.mjs';
const live = {
  VITE_FIREBASE_API_KEY: 'real-public-key', VITE_FIREBASE_PROJECT_ID: 'vintage-review',
  VITE_FIREBASE_AUTH_DOMAIN: 'vintage-review.firebaseapp.com', VITE_FIREBASE_APP_ID: '1:123:web:456',
  VITE_FIREBASE_STORAGE_BUCKET: 'vintage-review.firebasestorage.app', VITE_FIREBASE_WORKSPACE: 'pr-3'
};
test('live configuration has no emulator or dummy fallback', () => {
  assert.equal(firebaseSettings(live).emulator, false);
  for (const key of Object.keys(live)) assert.throws(() => firebaseSettings({ ...live, [key]: '' }), /Missing/);
  assert.throws(() => firebaseSettings({ ...live, VITE_FIREBASE_PROJECT_ID: 'demo-vintage' }), /real Firebase/);
});
test('test identity and emulator switches must agree and use a demo project', () => {
  assert.throws(() => firebaseSettings({ ...live, VITE_E2E: 'true' }), /explicit E2E/);
  assert.throws(() => firebaseSettings({ ...live, VITE_USE_FIREBASE_EMULATORS: 'true' }), /explicit E2E/);
  assert.throws(() => firebaseSettings({ ...live, VITE_USE_FIREBASE_EMULATORS: 'true', VITE_E2E: 'true' }), /demo-vintage/);
  assert.equal(firebaseSettings({ ...live, VITE_USE_FIREBASE_EMULATORS: 'true', VITE_E2E: 'true', VITE_FIREBASE_PROJECT_ID: 'demo-vintage', VITE_FIREBASE_WORKSPACE: 'e2e' }).emulator, true);
});
test('workspace paths cannot escape their namespace', () => {
  for (const value of ['../main', 'pr-3/users', '', 'e2e']) assert.throws(() => firebaseSettings({ ...live, VITE_FIREBASE_WORKSPACE: value }));
});

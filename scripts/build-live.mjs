import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { firebaseSettings } from '../src/lib/firebase-config.mjs';
const config = JSON.parse(readFileSync('firebase.review.json', 'utf8'));
const workspace = process.env.VINTAGE_WORKSPACE;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const env = {
  ...process.env,
  PUBLIC_BASE_PATH: '',
  VITE_USE_FIREBASE_EMULATORS: 'false', VITE_E2E: 'false',
  VITE_FIREBASE_PROJECT_ID: config.projectId, VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain, VITE_FIREBASE_APP_ID: config.appId,
  VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket, VITE_FIREBASE_WORKSPACE: workspace,
  VITE_BUILD_REVISION: revision
};
firebaseSettings(env);
execFileSync('npm', ['run', 'build'], { env, stdio: 'inherit' });
writeFileSync('build/version.json', JSON.stringify({ projectId: config.projectId, workspace, revision, backend: 'live' }) + '\n');

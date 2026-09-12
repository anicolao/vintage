/** @param {Record<string, string | undefined>} env */
export function firebaseSettings(env) {
  const emulator = env.VITE_USE_FIREBASE_EMULATORS === 'true';
  const e2e = env.VITE_E2E === 'true';
  if (emulator !== e2e) throw new Error('Emulators require an explicit E2E build.');
  const names = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID', 'STORAGE_BUCKET', 'WORKSPACE'];
  for (const name of names) {
    if (!env[`VITE_FIREBASE_${name}`]?.trim()) throw new Error(`Missing VITE_FIREBASE_${name}`);
  }
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (emulator && projectId !== 'demo-vintage') throw new Error('E2E requires the demo-vintage project.');
  if (!emulator && (projectId?.startsWith('demo-') || /e2e|preview-api-key/.test(`${projectId} ${env.VITE_FIREBASE_API_KEY}`))) {
    throw new Error('Live builds require a real Firebase project and web configuration.');
  }
  const workspace = env.VITE_FIREBASE_WORKSPACE ?? '';
  if (!/^(pr-[1-9][0-9]*|main|e2e)$/.test(workspace) || (!emulator && workspace === 'e2e')) {
    throw new Error('Invalid Firebase workspace.');
  }
  return {
    emulator,
    workspace,
    revision: env.VITE_BUILD_REVISION || 'local',
    config: {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId,
      appId: env.VITE_FIREBASE_APP_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
    }
  };
}

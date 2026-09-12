import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const digest = createHash('sha256');
for (const file of ['firestore.rules', 'storage.rules']) {
  digest.update(file + '\0');
  digest.update(readFileSync(file));
}
export const backendDigest = digest.digest('hex');
if (process.argv.includes('--check')) {
  if (process.env.FIREBASE_BACKEND_SHA256 !== backendDigest) {
    console.error('Backend contract differs from the approved live review rules. Use a separate Firebase project or review compatibility and update FIREBASE_BACKEND_SHA256 before deploying.');
    process.exitCode = 1;
  }
} else console.log(backendDigest);

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
const digest = createHash('sha256');
const sources = directory => readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : entry.isDirectory() ? sources(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
for (const file of ['firestore.rules', 'storage.rules', ...sources('functions').sort()]) {
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

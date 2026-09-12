import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const config = JSON.parse(readFileSync('firebase.review.json', 'utf8'));
const version = JSON.parse(readFileSync('build/version.json', 'utf8'));
if (version.projectId !== config.projectId || version.backend !== 'live' || !/^(main|pr-[1-9][0-9]*)$/.test(version.workspace)) throw new Error('Build is not a live preview.');
execFileSync('node', ['scripts/backend-digest.mjs', '--check'], { stdio: 'inherit' });
const firebase = (...args) => execFileSync('node', ['node_modules/firebase-tools/lib/bin/firebase.js', ...args, '--project', config.projectId, '--non-interactive'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
console.log(firebase('deploy', '--only', 'firestore:rules,storage'));
let url;
if (version.workspace === 'main') {
  console.log(firebase('deploy', '--only', 'hosting'));
  url = `https://${config.projectId}.web.app`;
} else {
  const response = JSON.parse(firebase('hosting:channel:deploy', version.workspace, '--expires', '30d', '--json'));
  url = Object.values(response.result).find(value => value.url)?.url;
}
if (!url) throw new Error('Firebase did not return a preview URL.');
writeFileSync('preview.json', JSON.stringify({ ...version, url }) + '\n');
console.log(`Live Firebase preview: ${url}`);

import { readFileSync } from 'node:fs';
const expected = JSON.parse(readFileSync('preview.json', 'utf8'));
const response = await fetch(`${expected.url}/version.json`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
if (!response.ok) throw new Error('Preview metadata is unavailable.');
const actual = await response.json();
for (const key of ['projectId', 'workspace', 'revision', 'backend']) if (actual[key] !== expected[key]) throw new Error(`Preview ${key} does not match this build.`);
for (const path of ['/connection-check', '/listings/new', '/listings/route-check']) {
  const route = await fetch(`${expected.url}${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!route.ok || !(await route.text()).includes('<html')) throw new Error(`Hosting must serve the SPA at ${path}.`);
}
console.log(`Verified deployed revision and SPA rewrite: ${expected.url}`);

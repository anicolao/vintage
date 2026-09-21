import { readFileSync } from 'node:fs';
const expected = JSON.parse(readFileSync('preview.json', 'utf8'));
// Hosting publication can briefly serve the preceding revision from an edge.
// Retry the observed revision, never accept stale metadata as a successful deploy.
const deadline=Date.now()+60000;
let verified=false;
while(Date.now()<deadline) {
  try {
    const response=await fetch(`${expected.url}/version.json?revision=${encodeURIComponent(expected.revision)}&check=${Date.now()}`,{signal:AbortSignal.timeout(Math.max(1,Math.min(8000,deadline-Date.now()))),cache:'no-store'});
    if(response.ok){const actual=await response.json();verified=['projectId','workspace','revision','backend'].every(key=>actual[key]===expected[key]);}
  } catch { /* A transient transport failure is bounded by the deployment deadline. */ }
  if(verified)break;
  await new Promise(resolve=>setTimeout(resolve,Math.min(1000,Math.max(0,deadline-Date.now()))));
}
if(!verified)throw new Error('Preview metadata did not converge to the deployed project, workspace and revision within 60 seconds.');
for (const path of ['/', '/index.html', '/listings/new', '/listings/route-check']) {
  const route = await fetch(`${expected.url}${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!/(?:^|,)\s*(?:no-cache|no-store)(?:\s|,|$)/i.test(route.headers.get('cache-control') ?? '')) throw new Error(`Hosting must revalidate the app shell at ${path}.`);
  if (!route.ok || !(await route.text()).includes('<html')) throw new Error(`Hosting must serve the SPA at ${path}.`);
}
console.log(`Verified deployed revision and SPA rewrite: ${expected.url}`);

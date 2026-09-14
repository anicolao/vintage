import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const files = directory => readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory() ? files(join(directory,entry.name)) : [join(directory,entry.name)]);
const errors=[];
for (const file of files('tests/e2e').filter(f=>f.endsWith('.ts'))) {
  const source=readFileSync(file,'utf8');
  if (/waitForTimeout|setTimeout|\bsleep\s*\(/.test(source)) errors.push(`${file}: synchronize with observable events, never sleeps`);
  for(const match of source.matchAll(/timeout\s*:\s*([\d_]+)/g)) if(Number(match[1].replaceAll('_',''))>2000)errors.push(`${file}: in-test timeout exceeds 2,000 ms`);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('E2E wait policy passed.');

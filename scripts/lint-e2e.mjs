import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const files = directory => readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory() ? files(join(directory,entry.name)) : [join(directory,entry.name)]);
const errors=[];
for (const file of files('tests/e2e').filter(f=>f.endsWith('.ts'))) {
  const source=readFileSync(file,'utf8');
  if (/waitForTimeout|setTimeout|\bsleep\s*\(/.test(source)) errors.push(`${file}: synchronize with observable events, never sleeps`);
  for(const match of source.matchAll(/timeout\s*:\s*([\d_]+)/g)) {
    const line=source.slice(source.lastIndexOf('\n',match.index)+1,source.indexOf('\n',match.index));
    const ceiling=line.includes('page.waitForResponse(')?15000:2000;
    if(Number(match[1].replaceAll('_',''))>ceiling)errors.push(`${file}: timeout exceeds ${ceiling} ms (${ceiling===2000?'UI action/assertion':'background response'})`);
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('E2E wait policy passed.');

import {spawn} from 'node:child_process';
import {startAiServer} from '../tests/fixtures/ai-server.mjs';
const server=await startAiServer();
const update=process.argv.includes('--update-snapshots');
const child=spawn('firebase',['emulators:exec','--project','demo-vintage','--only','auth,firestore,storage,functions',`node --test tests/rules/*.test.mjs && node --test tests/pipeline/*.test.mjs && node scripts/warm-functions.mjs && playwright test${update?' --update-snapshots=all':''}`],{stdio:'inherit',env:{...process.env,VINTAGE_AI_TEST_ENDPOINT:'http://127.0.0.1:9399',FUNCTIONS_EMULATOR:'true'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);server.close();process.exitCode=1;});
child.on('exit',code=>{server.close();process.exitCode=code ?? 1;});

// Operator-only: publish the local key to Secret Manager without printing it.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const require=createRequire(import.meta.url);
const auth=require('../node_modules/firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();
if(!account)throw new Error('Sign into Firebase CLI first.');
const key=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8')).SOLDGRAPH_API_KEY;
if(!key?.trim()||/[\r\n]/.test(key))throw new Error('Set SOLDGRAPH_API_KEY in .env.');
const access=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const project='vintage-review-anicolao';
async function api(url,method='GET',body) {
 const r=await fetch(url,{method,headers:{Authorization:`Bearer ${access.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const e=new Error(`Secret configuration HTTP ${r.status}`);e.status=r.status;throw e;}return r.json();
}
const url=`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/SOLDGRAPH_API_KEY`;
try{await api(url);}catch(e){if(e.status!==404)throw e;await api(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets?secretId=SOLDGRAPH_API_KEY`,'POST',{replication:{automatic:{}}});}
await api(`${url}:addVersion`,'POST',{payload:{data:Buffer.from(key).toString('base64')}});
const policy=await api(`${url}:getIamPolicy`);policy.bindings ||= [];
for(const [role,name] of [['roles/secretmanager.secretAccessor','vintage-pipeline-runtime'],['roles/secretmanager.viewer','vintage-preview-deploy']]){
 let b=policy.bindings.find(b=>b.role===role&&!b.condition);if(!b){b={role,members:[]};policy.bindings.push(b);}
 const member=`serviceAccount:${name}@${project}.iam.gserviceaccount.com`;if(!b.members.includes(member))b.members.push(member);
}
await api(`${url}:setIamPolicy`,'POST',{policy});
console.log('Soldgraph key stored in Secret Manager with runtime access.');

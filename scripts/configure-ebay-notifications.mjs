// Operator-only deployment setup. Credentials and generated tokens never printed.
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const require=createRequire(import.meta.url);
const auth=require('../node_modules/firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();
if(!account)throw new Error('Sign into Firebase CLI first.');
const access=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const project='vintage-review-anicolao';
const directory=new URL('../.cache/ebay-notifications/',import.meta.url);
await mkdir(directory,{recursive:true,mode:0o700});
const file=new URL('setup.env',directory);
let saved={};try{saved=parseEnv(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const verificationToken=saved.EBAY_DELETION_VERIFICATION_TOKEN || randomBytes(32).toString('hex');
const endpoint=`https://europe-west1-${project}.cloudfunctions.net/ebayAccountDeletion`;
await writeFile(file,`EBAY_DELETION_ENDPOINT=${endpoint}\nEBAY_DELETION_VERIFICATION_TOKEN=${verificationToken}\n`,{mode:0o600});
const credentials=parseEnv(await readFile(new URL('../.env.production',import.meta.url),'utf8'));
if(!credentials.EBAY_APP_ID || !credentials.EBAY_CERT_ID)throw new Error('Production credentials missing.');
async function api(url,method='GET',body) {
 const r=await fetch(url,{method,headers:{Authorization:`Bearer ${access.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const info=await r.json();const reason=info.error?.details?.find(d=>d.reason)?.reason || info.error?.status || 'unknown';const e=new Error(`Cloud setup HTTP ${r.status}: ${reason}`);e.status=r.status;throw e;}return r.json();
}
let operation=await api(`https://serviceusage.googleapis.com/v1/projects/${project}/services/secretmanager.googleapis.com:enable`,'POST',{});
while(!operation.done){await new Promise(resolve=>setTimeout(resolve,2000));operation=await api(`https://serviceusage.googleapis.com/v1/${operation.name}`);}
if(operation.error)throw new Error('Secret Manager activation failed.');
for(const [name,value] of [['EBAY_DELETION_VERIFICATION_TOKEN',verificationToken],['EBAY_NOTIFICATION_CREDENTIALS',JSON.stringify({appId:credentials.EBAY_APP_ID,certId:credentials.EBAY_CERT_ID})]]){
 const url=`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}`;
 try{await api(url);}catch(e){if(e.status!==404)throw e;await api(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets?secretId=${name}`,'POST',{replication:{automatic:{}}});}
 await api(`${url}:addVersion`,'POST',{payload:{data:Buffer.from(value).toString('base64')}});
 const policy=await api(`${url}:getIamPolicy`);policy.bindings ||= [];
 for(const [role,accountName] of [['roles/secretmanager.secretAccessor','vintage-pipeline-runtime'],['roles/secretmanager.viewer','vintage-preview-deploy']]){
  let b=policy.bindings.find(b=>b.role===role&&!b.condition);if(!b){b={role,members:[]};policy.bindings.push(b);}
  const member=`serviceAccount:${accountName}@${project}.iam.gserviceaccount.com`;if(!b.members.includes(member))b.members.push(member);
 }
 await api(`${url}:setIamPolicy`,'POST',{policy});
}
console.log('Stored notification secrets in Secret Manager. Local setup: .cache/ebay-notifications/setup.env');

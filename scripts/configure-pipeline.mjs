// Operator-only provisioning. Uses the Firebase CLI login; never prints tokens.
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const auth=require('../node_modules/firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();
if (!account) throw new Error('Sign into the Firebase CLI first.');
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
async function api(url,method='GET',body) {
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:body ? JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw new Error(`${response.status}: ${data.error?.message || 'Cloud configuration failed'}`);return data;
}
const project='vintage-review-anicolao';
const runtime=`vintage-pipeline-runtime@${project}.iam.gserviceaccount.com`;
const deploy=`vintage-preview-deploy@${project}.iam.gserviceaccount.com`;
const base=`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`;
try{await api(`${base}/${runtime}`);}catch(e){if(!e.message.startsWith('404'))throw e;await api(base,'POST',{accountId:'vintage-pipeline-runtime',serviceAccount:{displayName:'Vintage pipeline runtime'}});}
const url=`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
const policy=await api(`${url}:getIamPolicy`,'POST',{options:{requestedPolicyVersion:3}});
const add=(role,member)=>{let b=policy.bindings.find(x=>x.role===role&&!x.condition);if(!b){b={role,members:[]};policy.bindings.push(b);}if(!b.members.includes(member))b.members.push(member);};
for(const role of ['roles/datastore.user','roles/eventarc.eventReceiver','roles/run.invoker'])add(role,`serviceAccount:${runtime}`);
for(const role of ['roles/cloudfunctions.admin','roles/run.admin','roles/eventarc.admin','roles/cloudscheduler.admin'])add(role,`serviceAccount:${deploy}`);
await api(`${url}:setIamPolicy`,'POST',{policy});
const saPolicy=await api(`${base}/${runtime}:getIamPolicy`,'POST',{options:{requestedPolicyVersion:3}});
saPolicy.bindings ||= [];
let binding=saPolicy.bindings.find(x=>x.role==='roles/iam.serviceAccountUser');if(!binding){binding={role:'roles/iam.serviceAccountUser',members:[]};saPolicy.bindings.push(binding);}if(!binding.members.includes(`serviceAccount:${deploy}`))binding.members.push(`serviceAccount:${deploy}`);
await api(`${base}/${runtime}:setIamPolicy`,'POST',{policy:saPolicy});
const bucket=`https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app/iam`;
const storagePolicy=await api(`${bucket}?optionsRequestedPolicyVersion=3`);storagePolicy.bindings ||= [];
let storage=storagePolicy.bindings.find(x=>x.role==='roles/storage.objectAdmin');if(!storage){storage={role:'roles/storage.objectAdmin',members:[]};storagePolicy.bindings.push(storage);}if(!storage.members.includes(`serviceAccount:${runtime}`))storage.members.push(`serviceAccount:${runtime}`);
await api(bucket,'PUT',storagePolicy);
console.log('Configured dedicated pipeline runtime and CI deployment roles. Existing bindings preserved.');

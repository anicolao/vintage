import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {handler,challengeResponse} from '../../functions/ebay-deletion.mjs';
import {syncDeletions} from '../../scripts/sync-ebay-deletions.mjs';
const token='a'.repeat(64), endpoint='https://example.com/notification';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const body={metadata:{topic:'MARKETPLACE_ACCOUNT_DELETION'},notification:{notificationId:'test-id',data:{username:'deleted-user'}}};
function response(){return {code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},end(){return this;}};}
function request(payload=body){const raw=Buffer.from(JSON.stringify(payload));return {method:'POST',rawBody:raw,get:()=>Buffer.from(JSON.stringify({kid:'key-1',signature:sign('sha1',raw,privateKey).toString('base64')})).toString('base64')};}
test('challenge uses exact configured endpoint and token; malformed challenge rejected',async()=>{
 assert.equal(challengeResponse('abc',token,endpoint),createHash('sha256').update('abc'+token+endpoint).digest('hex'));
 const h=handler({token:()=>token,endpoint});const res=response();await h({method:'GET',query:{challenge_code:['one','two']}},res);assert.equal(res.code,400);
});
test('valid signed deletion persists only notification hash before acknowledging',async()=>{
 let saved;const h=handler({getKey:async()=>publicKey,record:async x=>saved=x});const res=response();await h(request(),res);
 assert.equal(res.code,204);assert.match(saved,/^[a-f0-9]{64}$/);assert.ok(!saved.includes('deleted-user'));
});
test('forged, unsigned, malformed or wrong-topic notifications cannot trigger deletion',async()=>{
 let count=0;const h=handler({getKey:async()=>publicKey,record:async()=>count++});
 const forged=request();forged.rawBody=Buffer.from(JSON.stringify({...body,notification:{...body.notification,notificationId:'forged'}}));
 const unsigned=request();unsigned.get=()=>undefined;
 for(const req of [forged,unsigned,request({...body,metadata:{topic:'OTHER'}})]){const r=response();await h(req,r);assert.ok([400,412].includes(r.code));}
 assert.equal(count,0);
});
test('verification service or durable write failure returns retryable failure',async()=>{
 for(const deps of [{getKey:async()=>{throw new Error();}},{getKey:async()=>publicKey,record:async()=>{throw new Error();}}]){
  const r=response();await handler(deps)(request(),r);assert.equal(r.code,503);
 }
});
test('revision endpoint exposes no identity and disallows unsupported methods',async()=>{
 const h=handler({revision:async()=>7});const r=response();await h({method:'GET',query:{}},r);assert.deepEqual(r.body,{revision:7});assert.equal(r.headers['Cache-Control'],'no-store');
 const other=response();await h({method:'DELETE'},other);assert.equal(other.code,405);
});
test('changed deletion revision erases generated runs and preserves unrelated paths',async()=>{
 const dir=await mkdtemp(tmpdir()+'/vintage-deletions-');const root=pathToFileURL(dir+'/');
 try{
  const transport=async()=>new Response(JSON.stringify({revision:1}));
  await syncDeletions({root,transport});
  await mkdir(new URL('run-example/',root));await writeFile(new URL('run-example/results.json',root),'private');await writeFile(new URL('keep.txt',root),'keep');
  assert.equal((await syncDeletions({root,transport})).removed,0);
  assert.equal((await syncDeletions({root,transport:async()=>new Response(JSON.stringify({revision:2}))})).removed,1);
  await assert.rejects(access(new URL('run-example/results.json',root)));await access(new URL('keep.txt',root));
  await assert.rejects(syncDeletions({root,transport:async()=>new Response('',{status:503})}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

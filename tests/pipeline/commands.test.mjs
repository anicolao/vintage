import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PipelineService } from '../../functions/service.mjs';
import { digest } from '../../functions/photos.mjs';
import { resolvedSnapshot, reduceWorkflow } from '../../functions/shared/proposal.mjs';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
let app,db,service,bucket;
before(()=>{
  if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8280') throw new Error('Pipeline tests require local emulators');
  app=initializeApp({projectId:'demo-vintage',storageBucket:'demo-vintage.appspot.com'},'pipeline-tests');db=getFirestore(app);bucket=getStorage(app).bucket();service=new PipelineService(db,bucket,'demo-vintage');
  service.account=(workspace,uid)=>db.doc(`_pipelineTests/${workspace}/accounts/${uid}`);
});
after(async()=>{await db?.terminate();if(app)await deleteApp(app);});
const submit=(uid,request,commandId=randomUUID())=>service.submit(uid,{workspace:'e2e',commandId,request});
async function seller() {
  const uid=`pipeline-${randomUUID()}`;const account=service.account('e2e',uid);await account.set({ownerUid:uid});
  const examples=[{id:randomUUID(),title:'My cotton shirt',description:'Soft cotton, relaxed fit. Small mark shown in the photos.'}];
  await submit(uid,{kind:'examples',expectedVersion:0,examples,previousExamples:[]});
  const commandId=randomUUID();await submit(uid,{kind:'learn',expectedVersion:1},commandId);
  await service.execute(account.collection('operations').doc(commandId));
  return {uid,account,style:(await account.collection('style').doc('state').get()).data()};
}
async function listing() {
  const sellerData=await seller();const {uid,account,style}=sellerData;
  const listingId=randomUUID();const path=`${account.path}/listings/${listingId}`;
  const bytes=readFileSync('static/images/wardrobe.png');const photo={id:randomUUID(),path:'',previewPath:'',digest:digest(bytes),type:'image/png',size:bytes.length,width:100,height:100};
  photo.path=`${path}/photos/${photo.id}/original`;photo.previewPath=photo.path;
  await bucket.file(photo.path).save(bytes,{resumable:false,contentType:'image/png'});
  await db.doc(path).set({ownerUid:uid,version:2});
  await db.doc(`${path}/events/photo`).set({type:'photo/uploaded',payload:{photo}});
  const request={kind:'generate',listingId,expectedVersion:0,photoIds:[photo.id],context:'',styleVersion:style.version,replace:false};
  const commandId=randomUUID();await submit(uid,request,commandId);
  const op=account.collection('operations').doc(commandId);
  await service.execute(op);await service.execute(op);
  const target=db.doc(`${path}/pipeline/state`);
  return {...sellerData,listingId,target,photo,request,commandId,op};
}
test('examples validate, invalidate readiness, and reject stale or cross-owner commands',async()=>{
  const {uid,style,account}=await seller();assert.equal(style.status,'ready');assert.equal(style.profile.sample,true);
  await assert.rejects(()=>submit(uid,{kind:'examples',expectedVersion:0,examples:[],previousExamples:[]}));
  await submit(uid,{kind:'examples',expectedVersion:style.version,examples:[],previousExamples:style.examples});
  assert.equal((await account.collection('style').doc('state').get()).data().profile,null);
  await assert.rejects(()=>submit(uid,{kind:'learn',expectedVersion:style.version+1}));
  await assert.rejects(()=>submit('another-owner',{kind:'learn',expectedVersion:0}));
});
test('durable generation is idempotent; edits and approval preserve exact reviewed content',async()=>{
  const {uid,account,listingId,target,request,commandId,photo}=await listing();
  const generated=(await target.get()).data();assert.equal(generated.status,'reviewing');assert.equal(generated.version,4);
  await submit(uid,request,commandId);assert.equal((await target.get()).data().version,4);
  await assert.rejects(()=>submit(uid,{...request,context:'different'},commandId));
  await submit(uid,{kind:'edit',listingId,expectedVersion:4,field:'title',value:'My checked title',previousValue:generated.copy.title});
  await assert.rejects(()=>submit(uid,{kind:'edit',listingId,expectedVersion:5,field:'title',value:'Stale tab copy',previousValue:generated.copy.title}));
  await submit(uid,{kind:'price',listingId,expectedVersion:5,price:{currency:'GBP',minor:4250}});
  let reviewed=(await target.get()).data();const snapshot=resolvedSnapshot(reviewed);
  await assert.rejects(()=>submit(uid,{kind:'approve',listingId,expectedVersion:6,baseVersion:2,snapshot:{...snapshot,copy:{...snapshot.copy,title:'Not displayed'}}}));
  await assert.rejects(()=>submit(uid,{kind:'approve',listingId,expectedVersion:5,baseVersion:2,snapshot}));
  await assert.rejects(()=>submit('another-owner',{kind:'approve',listingId,expectedVersion:6,baseVersion:2,snapshot}));
  const approval=randomUUID();const requestApproval={kind:'approve',listingId,expectedVersion:6,baseVersion:2,snapshot};
  await submit(uid,requestApproval,approval);await submit(uid,requestApproval,approval);
  const approved=(await target.get()).data();assert.equal(approved.version,7);assert.deepEqual(approved.approved,snapshot);assert.equal(approved.approved.price.minor,4250);
  await assert.rejects(()=>submit(uid,{kind:'edit',listingId,expectedVersion:7,field:'title',value:'Changed after approval',previousValue:snapshot.copy.title}));
  const events=await target.parent.parent.collection('workflowEvents').get();assert.deepEqual(reduceWorkflow(events.docs.map(d=>d.data())),approved);
  const [exists]=await bucket.file(photo.path.replace('original','analysis-v1')).exists();assert.equal(exists,true);
  assert.equal((await account.collection('operations').doc(approval).get()).data().status,'completed');
});
test('interrupted worker resumes a pinned request without overwriting edits or double stages',async()=>{
  const {uid,listingId,target,account,style,photo}=await listing();
  const commandId=randomUUID();const version=(await target.get()).data().version;
  await submit(uid,{kind:'generate',listingId,expectedVersion:version,styleVersion:style.version,photoIds:[photo.id],context:'',replace:true},commandId);
  const op=account.collection('operations').doc(commandId);
  const generator=service.generator;service.generator={generate(){throw new Error('interrupted provider');}};
  try{await assert.rejects(()=>service.execute(op));}finally{service.generator=generator;}
  assert.equal((await op.get()).data().stage,2);
  await service.execute(op);await service.execute(op);
  const state=(await target.get()).data();assert.equal(state.status,'reviewing');assert.equal(state.proposalId,commandId);assert.equal(state.version,version+4);
});

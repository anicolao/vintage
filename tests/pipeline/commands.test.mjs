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
  return {uid,account};
}
async function listing() {
  const sellerData=await seller();const {uid,account}=sellerData;
  const listingId=randomUUID();const path=`${account.path}/listings/${listingId}`;
  const bytes=readFileSync('static/images/wardrobe.png');const photo={id:randomUUID(),path:'',previewPath:'',digest:digest(bytes),type:'image/png',size:bytes.length,width:100,height:100};
  photo.path=`${path}/photos/${photo.id}/original`;photo.previewPath=photo.path;
  await bucket.file(photo.path).save(bytes,{resumable:false,contentType:'image/png'});
  await db.doc(path).set({ownerUid:uid,version:2});
  await db.doc(`${path}/events/photo`).set({type:'photo/uploaded',payload:{photo}});
  const request={kind:'generate',listingId,expectedVersion:0,photoIds:[photo.id],context:'',replace:false};
  const commandId=randomUUID();await submit(uid,request,commandId);
  const op=account.collection('operations').doc(commandId);
  await service.execute(op);await service.execute(op);
  const target=db.doc(`${path}/pipeline/state`);
  return {...sellerData,listingId,target,photo,request,commandId,op};
}
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
  const {uid,listingId,target,account,photo}=await listing();
  const commandId=randomUUID();const version=(await target.get()).data().version;
  await submit(uid,{kind:'generate',listingId,expectedVersion:version,photoIds:[photo.id],context:'',replace:true},commandId);
  const op=account.collection('operations').doc(commandId);
  const generator=service.generator;service.generator={generate(){throw new Error('interrupted provider');}};
  try{await assert.rejects(()=>service.execute(op));}finally{service.generator=generator;}
  assert.equal((await op.get()).data().stage,1);
  await service.execute(op);await service.execute(op);
  const state=(await target.get()).data();assert.equal(state.status,'reviewing');assert.equal(state.proposalId,commandId);assert.equal(state.version,version+4);
});

test('feedback changes wording, remembers instructions, preserves price, and forgetting affects future requests',async()=>{
  const {uid,account,listingId,target,photo}=await listing();
  let state=(await target.get()).data();
  const previousCopy={title:state.copy.title,description:state.copy.description};
  await submit(uid,{kind:'price',listingId,expectedVersion:state.version,price:{currency:'GBP',minor:3500}});
  state=(await target.get()).data();
  const commandId=randomUUID();const feedback={kind:'feedback',listingId,expectedVersion:state.version,text:'Keep it concise.',previousCopy};
  await submit(uid,feedback,commandId);await submit(uid,feedback,commandId);
  await service.execute(account.collection('operations').doc(commandId));
  state=(await target.get()).data();assert.equal(state.revision.status,'applied');assert.match(state.copy.description,/Revised wording/);assert.equal(state.price.minor,3500);
  assert.equal((await account.collection('language').doc('state').get()).data().instructions.length,1);
  const next=randomUUID();await submit(uid,{kind:'generate',listingId,expectedVersion:state.version,photoIds:[photo.id],context:'',replace:true},next);
  assert.equal((await account.collection('operations').doc(next).get()).data().input.instructions[0].text,'Keep it concise.');
  await service.execute(account.collection('operations').doc(next));state=(await target.get()).data();
  await submit(uid,{kind:'forget',listingId,expectedVersion:state.version,instructionId:commandId});
  assert.deepEqual((await account.collection('language').doc('state').get()).data().instructions,[]);
  await assert.rejects(()=>submit('another-owner',feedback));
});
test('revision never overwrites newer wording; failed revisions retain original text and instructions',async()=>{
  const {uid,account,listingId,target}=await listing();let state=(await target.get()).data();
  const previousCopy={title:state.copy.title,description:state.copy.description};
  const commandId=randomUUID();await submit(uid,{kind:'feedback',listingId,expectedVersion:state.version,text:'Shorter.',previousCopy},commandId);
  state=(await target.get()).data();
  await submit(uid,{kind:'edit',listingId,expectedVersion:state.version,field:'title',previousValue:state.copy.title,value:'New manual title'});
  await service.execute(account.collection('operations').doc(commandId));state=(await target.get()).data();
  assert.equal(state.copy.title,'New manual title');assert.equal(state.revision.status,'conflict');
  const failing=randomUUID();await submit(uid,{kind:'feedback',listingId,expectedVersion:state.version,text:'No adjectives.',previousCopy:{title:state.copy.title,description:state.copy.description}},failing);
  const provider=service.generator;service.generator={revise(){throw new Error('provider failed');}};
  try{await assert.rejects(()=>service.execute(account.collection('operations').doc(failing)));await assert.rejects(()=>service.execute(account.collection('operations').doc(failing)));await service.execute(account.collection('operations').doc(failing));}finally{service.generator=provider;}
  const after=(await target.get()).data();assert.equal(after.revision.status,'failed');assert.deepEqual(after.copy,state.copy);
  assert.equal((await account.collection('language').doc('state').get()).data().instructions.length,2);
});

test('save incomplete drafts, reopen approved content, and require fresh exact approval',async()=>{
  const {uid,listingId,target}=await listing();let state=(await target.get()).data();
  await submit(uid,{kind:'edit',listingId,expectedVersion:state.version,field:'title',previousValue:state.copy.title,value:''});
  state=(await target.get()).data();
  await submit(uid,{kind:'save',listingId,expectedVersion:state.version});
  state=(await target.get()).data();assert.equal(state.status,'saved');assert.equal(state.price,null);assert.equal(state.copy.title,'');
  await submit(uid,{kind:'edit',listingId,expectedVersion:state.version,field:'title',previousValue:'',value:'Ready title'});
  state=(await target.get()).data();await submit(uid,{kind:'price',listingId,expectedVersion:state.version,price:{currency:'GBP',minor:3100}});
  state=(await target.get()).data();const snapshot=resolvedSnapshot(state);
  await submit(uid,{kind:'approve',listingId,expectedVersion:state.version,baseVersion:2,snapshot});
  state=(await target.get()).data();const approvedVersion=state.version;
  await submit(uid,{kind:'reopen',listingId,expectedVersion:approvedVersion});
  state=(await target.get()).data();assert.equal(state.status,'reviewing');assert.equal(state.approved,null);assert.deepEqual(state.copy,snapshot.copy);
  await assert.rejects(()=>submit(uid,{kind:'reopen',listingId,expectedVersion:approvedVersion}));
  await submit(uid,{kind:'edit',listingId,expectedVersion:state.version,field:'title',previousValue:state.copy.title,value:'Revised title'});
  state=(await target.get()).data();await assert.rejects(()=>submit(uid,{kind:'approve',listingId,expectedVersion:state.version,baseVersion:2,snapshot}));
  await submit(uid,{kind:'price',listingId,expectedVersion:state.version,price:null});
  state=(await target.get()).data();assert.equal(state.price,null);
  await submit(uid,{kind:'price',listingId,expectedVersion:state.version,price:{currency:'GBP',minor:3500}});
  state=(await target.get()).data();await submit(uid,{kind:'approve',listingId,expectedVersion:state.version,baseVersion:2,snapshot:resolvedSnapshot(state)});
  state=(await target.get()).data();assert.equal(state.approved.copy.title,'Revised title');assert.equal(state.approved.price.minor,3500);
});

test('duplicate approved listings with independent files, replayable capture and isolated edits',async()=>{
  const {uid,listingId,target,account,photo}=await listing();let state=(await target.get()).data();
  const targetId=randomUUID();const duplicate={kind:'duplicate',listingId:targetId,expectedVersion:0,sourceListingId:listingId,sourceVersion:state.version};
  await assert.rejects(()=>submit(uid,duplicate,targetId));
  await submit(uid,{kind:'price',listingId,expectedVersion:state.version,price:{currency:'GBP',minor:2400}});
  state=(await target.get()).data();await submit(uid,{kind:'approve',listingId,expectedVersion:state.version,baseVersion:2,snapshot:resolvedSnapshot(state)});
  const original=(await target.get()).data();duplicate.sourceVersion=original.version;
  await assert.rejects(()=>submit('another-owner',duplicate,targetId));
  await Promise.all([submit(uid,duplicate,targetId),submit(uid,duplicate,targetId)]);
  const cloned=account.collection('listings').doc(targetId);const pipeline=cloned.collection('pipeline').doc('state');
  let copy=(await pipeline.get()).data();assert.equal(copy.status,'saved');assert.equal(copy.approved,null);assert.equal(copy.version,1);assert.deepEqual(copy.copy,original.approved.copy);assert.deepEqual(copy.price,original.price);
  assert.notEqual(copy.input.photos[0].path,photo.path);
  assert.deepEqual((await bucket.file(copy.input.photos[0].path).download())[0],(await bucket.file(photo.path).download())[0]);
  const {reduceListing}=await import('../../src/lib/events/listing.mjs');
  const capture=reduceListing((await cloned.collection('events').get()).docs.map(d=>d.data()),targetId,uid);
  assert.deepEqual(capture.diagnostics,[]);assert.deepEqual(capture.photos,copy.input.photos);assert.equal(capture.version,copy.input.baseVersion);
  await submit(uid,{kind:'edit',listingId:targetId,expectedVersion:copy.version,field:'title',previousValue:copy.copy.title,value:'Independent title'});
  await submit(uid,duplicate,targetId);copy=(await pipeline.get()).data();assert.equal(copy.copy.title,'Independent title');assert.equal(copy.version,2);
  assert.deepEqual((await target.get()).data(),original);
  await submit(uid,{kind:'approve',listingId:targetId,expectedVersion:copy.version,baseVersion:capture.version,snapshot:resolvedSnapshot(copy)});
  copy=(await pipeline.get()).data();await submit(uid,{kind:'reopen',listingId:targetId,expectedVersion:copy.version});
  copy=(await pipeline.get()).data();const generation=randomUUID();
  await submit(uid,{kind:'generate',listingId:targetId,expectedVersion:copy.version,photoIds:copy.input.photos.map(p=>p.id),context:copy.input.context,replace:true},generation);
  await service.execute(account.collection('operations').doc(generation));
  assert.equal((await pipeline.get()).data().status,'reviewing');
  await submit(uid,{kind:'reopen',listingId,expectedVersion:original.version});
  const staleId=randomUUID();await assert.rejects(()=>submit(uid,{...duplicate,listingId:staleId},staleId));
});

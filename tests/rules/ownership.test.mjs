import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let environment;
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8280' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9290') throw new Error('Rules tests require local emulators.');
  environment = await initializeTestEnvironment({
    projectId: 'demo-vintage',
    firestore: { host: '127.0.0.1', port: 8280, rules: readFileSync('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 9290, rules: readFileSync('storage.rules', 'utf8') }
  });
});
after(async () => environment?.cleanup());
// Descriptor and event must advance together: every relevant write changes version.
const account = uid => `workspaces/e2e/accounts/${uid}`;
const draftId = uid => `${uid}-device-2`;
const domainEvent = (uid, seq, streamId, type, payload, version) => ({ id:`${uid}-device-${seq}`, actorUid:uid, deviceId:'device', clientSeq:seq, streamId, type, payload, correlationId:`${uid}-device-${seq}`, causationId:null, createdAt:serverTimestamp(), schemaVersion:2, reducerVersion:1 });
const descriptor = (uid, lastEventId, version) => ({ ownerUid:uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), version, lastEventId });
async function createStream(db, path, event) {
  const { writeBatch } = await import('firebase/firestore');
  const batch=writeBatch(db);
  batch.set(doc(db,path),descriptor(event.actorUid,event.id,1)); batch.set(doc(db,`${path}/events/${event.id}`),event);
  return batch.commit();
}
test('atomic account and draft creation; event-only and descriptor-only writes fail', async () => {
  const uid='domain-alice'; const db=environment.authenticatedContext(uid).firestore();
  await assertFails(setDoc(doc(db,account(uid)),descriptor(uid,`${uid}-device-1`,1)));
  await assertSucceeds(createStream(db,account(uid),domainEvent(uid,1,uid,'account/created',{},1)));
  const path=`${account(uid)}/listings/${draftId(uid)}`;
  const event=domainEvent(uid,2,draftId(uid),'listing/created',{title:'Linen jacket'},1);
  await assertFails(setDoc(doc(db,`${path}/events/${event.id}`),event));
  await assertSucceeds(createStream(db,path,event));
  await assertSucceeds(getDoc(doc(db,path)));
  await assertFails(updateDoc(doc(db,path),{version:2,updatedAt:serverTimestamp()}));
  await assertFails(deleteDoc(doc(db,path)));
  await assertFails(updateDoc(doc(db,`${path}/events/${event.id}`),{payload:{title:'Rewritten'}}));
  await assertFails(deleteDoc(doc(db,`${path}/events/${event.id}`)));
  for (const context of [environment.unauthenticatedContext(),environment.authenticatedContext('mallory')]) {
    await assertFails(getDoc(doc(context.firestore(),path)));
    await assertFails(getDoc(doc(context.firestore(),`${path}/events/${event.id}`)));
    await assertFails(updateDoc(doc(context.firestore(),path),{version:2}));
  }
});
test('context advances version once; invalid envelopes, oversized payloads and privileged types are denied', async () => {
  const { writeBatch }=await import('firebase/firestore');
  const uid='domain-alice'; const db=environment.authenticatedContext(uid).firestore(); const path=`${account(uid)}/listings/${draftId(uid)}`;
  const append= async event => {
    const batch=writeBatch(db); batch.update(doc(db,path),{version:2,updatedAt:serverTimestamp(),lastEventId:event.id});batch.set(doc(db,`${path}/events/${event.id}`),event);return batch.commit();
  };
  const valid=domainEvent(uid,3,draftId(uid),'context/changed',{context:'Excellent condition'},2);
  for (const patch of [{actorUid:'mallory'},{streamId:'elsewhere'},{schemaVersion:1},{reducerVersion:99},{createdAt:new Date(0)},{clientSeq:0},{deviceId:'wrong'},{type:'generation/proposed',payload:{}},{payload:{context:'x'.repeat(2001)}},{payload:{context:'okay',admin:true}}]) await assertFails(append({...valid,...patch}));
  await assertSucceeds(append(valid));
  await assertFails(append(valid));
  assert.equal((await getDoc(doc(db,path))).data().version,2);
});

test('photo events validate owner paths and image metadata; retired note/check paths are denied', async () => {
  const { writeBatch } = await import('firebase/firestore');
  const uid='domain-alice'; const db=environment.authenticatedContext(uid).firestore();
  const path=`${account(uid)}/listings/${draftId(uid)}`;
  const photo={id:'photo-one',path:`${path}/photos/photo-one/original`,previewPath:`${path}/photos/photo-one/original`,type:'image/png',size:100,width:100,height:100,digest:'a'.repeat(64)};
  const append=async payload => {const e=domainEvent(uid,4,draftId(uid),'photo/uploaded',payload,3);const b=writeBatch(db);b.update(doc(db,path),{version:3,updatedAt:serverTimestamp(),lastEventId:e.id});b.set(doc(db,`${path}/events/${e.id}`),e);return b.commit();};
  await assertFails(append({photo:{...photo,path:'someone/else'}}));
  await assertFails(append({photo:{...photo,size:10485761}}));
  await assertSucceeds(append({photo}));
  await assertFails(getDoc(doc(db,`workspaces/e2e/users/${uid}`)));
  const storage=environment.authenticatedContext(uid).storage();
  const target=ref(storage,photo.path);
  await assertSucceeds(uploadBytes(target,new Uint8Array(100),{contentType:'image/png',customMetadata:{digest:photo.digest}}));
  await assertSucceeds(getBytes(target));
  await assertFails(uploadBytes(target,new Uint8Array(100),{contentType:'image/png',customMetadata:{digest:photo.digest}}));
  await assertFails(getBytes(ref(environment.authenticatedContext('mallory').storage(),photo.path)));
  await assertFails(uploadBytes(ref(storage,`${path}/photos/bad/original`),new Uint8Array(100),{contentType:'text/plain',customMetadata:{digest:photo.digest}}));
  await assertFails(uploadBytes(ref(storage,`workspaces/e2e/users/${uid}/checks/test.txt`),new Uint8Array(2),{contentType:'text/plain'}));
});

test('eager batches increment atomically without a network read and retries cannot double count', async () => {
  const { writeBatch, increment }=await import('firebase/firestore');
  const uid='eager-owner';const db=environment.authenticatedContext(uid).firestore();
  const path=`${account(uid)}/listings/${draftId(uid)}`;
  await assertSucceeds(createStream(db,path,domainEvent(uid,2,draftId(uid),'listing/created',{title:'Item'})));
  const append=(seq,version=increment(1))=>{
    const event=domainEvent(uid,seq,draftId(uid),'context/changed',{context:`Edit ${seq}`});
    const batch=writeBatch(db);batch.update(doc(db,path),{version,lastEventId:event.id,updatedAt:serverTimestamp()});batch.set(doc(db,`${path}/events/${event.id}`),event);return batch.commit();
  };
  await assertFails(append(3,7));
  await Promise.all([assertSucceeds(append(3)),assertSucceeds(append(4))]);
  await assertFails(append(3));
  assert.equal((await getDoc(doc(db,path))).data().version,3);
});

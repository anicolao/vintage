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
const data = (uid) => ({ ownerUid: uid, note: 'Saved note', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const path = (uid) => `workspaces/pr-3/users/${uid}`;

test('Firestore owner can create, read and update; cannot alter identity, schema or timestamps', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  const target = doc(alice, path('alice'));
  await assertSucceeds(setDoc(target, data('alice')));
  await assertSucceeds(getDoc(target));
  await assertSucceeds(updateDoc(target, { note: 'Updated', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(target, { ownerUid: 'bob', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(target, { admin: true, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(target, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(target, { note: 'a'.repeat(501), updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(target));
});
test('Firestore denies anonymous and cross-user access in every workspace', async () => {
  for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext('bob')]) {
    const target = doc(context.firestore(), path('alice'));
    await assertFails(getDoc(target));
    await assertFails(setDoc(target, data('alice')));
    await assertFails(getDoc(doc(context.firestore(), 'workspaces/main/users/alice')));
  }
  const bob = environment.authenticatedContext('bob').firestore();
  await assertFails(setDoc(doc(bob, path('bob')), data('alice')));
  await assertFails(setDoc(doc(bob, path('bob')), { ...data('bob'), createdAt: new Date(0) }));
  await assertFails(setDoc(doc(bob, `${path('bob')}/events/fake`), { type: 'generation/proposed' }));
});
test('Storage owner can round trip a bounded text check and remove it', async () => {
  const storage = environment.authenticatedContext('alice').storage();
  const target = ref(storage, `${path('alice')}/checks/valid.txt`);
  await assertSucceeds(uploadBytes(target, new TextEncoder().encode('hello'), { contentType: 'text/plain' }));
  await assertSucceeds(getBytes(target));
  await assertFails(uploadBytes(target, new Uint8Array(4), { contentType: 'text/plain' }));
  for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext('bob')]) {
    const forbidden = ref(context.storage(), target.fullPath);
    await assertFails(getBytes(forbidden));
    await assertFails(deleteObject(forbidden));
    await assertFails(uploadBytes(ref(context.storage(), `${path('alice')}/checks/other.txt`), new Uint8Array(4), { contentType: 'text/plain' }));
  }
  await assertSucceeds(deleteObject(target));
});
test('Storage denies oversize, wrong type and paths outside the check area', async () => {
  const storage = environment.authenticatedContext('alice').storage();
  await assertFails(uploadBytes(ref(storage, `${path('alice')}/checks/large.txt`), new Uint8Array(1025), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, `${path('alice')}/checks/html.txt`), new Uint8Array(4), { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(storage, `${path('alice')}/photo.png`), new Uint8Array(4), { contentType: 'image/png' }));
});

// Descriptor and event must advance together: every relevant write changes version.
const account = uid => `workspaces/e2e/accounts/${uid}`;
const draftId = uid => `${uid}-device-2`;
const domainEvent = (uid, seq, streamId, type, payload, version) => ({ id:`${uid}-device-${seq}`, actorUid:uid, deviceId:'device', clientSeq:seq, streamId, type, payload, correlationId:`${uid}-device-${seq}`, causationId:null, createdAt:serverTimestamp(), schemaVersion:2, reducerVersion:1, streamVersion:version });
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
    const batch=writeBatch(db); batch.update(doc(db,path),{version:event.streamVersion,updatedAt:serverTimestamp(),lastEventId:event.id});batch.set(doc(db,`${path}/events/${event.id}`),event);return batch.commit();
  };
  const valid=domainEvent(uid,3,draftId(uid),'context/changed',{context:'Excellent condition'},2);
  for (const patch of [{actorUid:'mallory'},{streamId:'elsewhere'},{schemaVersion:1},{reducerVersion:99},{createdAt:new Date(0)},{clientSeq:0},{deviceId:'wrong'},{streamVersion:7},{type:'generation/proposed',payload:{}},{payload:{context:'x'.repeat(2001)}},{payload:{context:'okay',admin:true}}]) await assertFails(append({...valid,...patch}));
  await assertSucceeds(append(valid));
  await assertFails(append(valid));
  assert.equal((await getDoc(doc(db,path))).data().version,2);
});

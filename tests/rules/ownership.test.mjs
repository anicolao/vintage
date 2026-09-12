import { after, before, test } from 'node:test';
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

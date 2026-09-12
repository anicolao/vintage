import { doc, getDocFromServer, runTransaction, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { getBackend, settings } from '../firebase';

export interface Workspace {
  ownerUid: string;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function workspaceDoc(uid: string) {
  return doc(getBackend().db, 'workspaces', settings.workspace, 'users', uid);
}

export async function loadWorkspace(uid: string): Promise<Workspace> {
  const target = workspaceDoc(uid);
  await runTransaction(getBackend().db, async (transaction) => {
    const snapshot = await transaction.get(target);
    if (!snapshot.exists()) transaction.set(target, {
      ownerUid: uid, note: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  });
  const snapshot = await getDocFromServer(target);
  return snapshot.data() as Workspace;
}

export async function saveNote(uid: string, note: string): Promise<string> {
  await setDoc(workspaceDoc(uid), { note, updatedAt: serverTimestamp() }, { merge: true });
  const snapshot = await getDocFromServer(workspaceDoc(uid));
  const saved = snapshot.data()?.note;
  if (saved !== note) throw new Error('The saved note changed. Reload and try again.');
  return saved;
}

export async function verifyStorage(uid: string): Promise<void> {
  const target = ref(getBackend().storage, `workspaces/${settings.workspace}/users/${uid}/checks/${crypto.randomUUID()}.txt`);
  const content = `Vintage storage check ${crypto.randomUUID()}`;
  let uploaded = false;
  try {
    await uploadBytes(target, new TextEncoder().encode(content), { contentType: 'text/plain' });
    uploaded = true;
    const bytes = await getBytes(target, 1024);
    if (new TextDecoder().decode(bytes) !== content) throw new Error('Storage verification did not match.');
  } finally {
    if (uploaded) await deleteObject(target);
  }
}

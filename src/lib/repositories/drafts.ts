import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getBackend, settings } from '../firebase';
import type { Command, Descriptor } from '../events/contracts';
import { SCHEMA_VERSION } from '../events/listing.mjs';
export const accountPath = (uid: string) => `workspaces/${settings.workspace}/accounts/${uid}`;
function descriptorPath(command: Command) {
  return command.type === 'account/created' ? accountPath(command.actorUid) : `${accountPath(command.actorUid)}/listings/${command.streamId}`;
}
export async function deliver(command: Command) {
  if (command.workspace !== settings.workspace || getBackend().auth.currentUser?.uid !== command.actorUid) throw new Error('Account changed. Sign in again to retry.');
  const db = getBackend().db;
  const descriptor = doc(db, descriptorPath(command));
  const target = doc(collection(descriptor, 'events'), command.id);
  await runTransaction(db, async transaction => {
    const [existing, stream] = await Promise.all([transaction.get(target), transaction.get(descriptor)]);
    if (existing.exists()) {
      const event = existing.data();
      if (event.actorUid !== command.actorUid || event.type !== command.type || JSON.stringify(event.payload) !== JSON.stringify(command.payload)) throw new Error('Conflicting event identity.');
      return;
    }
    if (command.type === 'account/created' && stream.exists()) return;
    if (command.type === 'listing/created' && stream.exists()) throw new Error('Draft already exists.');
    if (command.type === 'context/changed' && !stream.exists()) throw new Error('Draft no longer available.');
    const version = (stream.data()?.version ?? 0) + 1;
    const event = { id: command.id, actorUid: command.actorUid, deviceId: command.deviceId, clientSeq: command.clientSeq, streamId: command.streamId, type: command.type, payload: command.payload, correlationId: command.id, causationId: null, createdAt: serverTimestamp(), schemaVersion: SCHEMA_VERSION, reducerVersion: 1, streamVersion: version };
    transaction.set(target, event);
    const changes = { ownerUid: command.actorUid, version, lastEventId: command.id, updatedAt: serverTimestamp() };
    if (stream.exists()) transaction.update(descriptor, changes);
    else transaction.set(descriptor, { ...changes, createdAt: serverTimestamp() });
  });
}
export function watchDrafts(uid: string, next: (drafts: Descriptor[]) => void, error: (cause: Error) => void) {
  return onSnapshot(collection(getBackend().db, `${accountPath(uid)}/listings`), snapshot => {
    next(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Descriptor)).sort((a, b) => a.id.localeCompare(b.id)));
  }, error);
}
export function watchListing(uid: string, id: string, next: (events: unknown[]) => void, error: (cause: Error) => void) {
  return onSnapshot(collection(getBackend().db, `${accountPath(uid)}/listings/${id}/events`), { includeMetadataChanges: true }, snapshot => {
    next(snapshot.docs.map(d => ({ ...d.data(), id: d.id, createdAt: d.metadata.hasPendingWrites ? null : d.data().createdAt })));
  }, error);
}

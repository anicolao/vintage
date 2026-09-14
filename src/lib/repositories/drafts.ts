import { collection, doc, onSnapshot, getDocFromCache, getDocFromServer, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { getBackend, settings } from '../firebase';
import type { Command, Descriptor } from '../events/contracts';
import { SCHEMA_VERSION } from '../events/listing.mjs';
export const accountPath = (uid: string) => `workspaces/${settings.workspace}/accounts/${uid}`;
function descriptorPath(command: Command) {
  return command.type === 'account/created' ? accountPath(command.actorUid) : `${accountPath(command.actorUid)}/listings/${command.streamId}`;
}
export function eventFor(command: Command) {
  return { id: command.id, actorUid: command.actorUid, deviceId: command.deviceId, clientSeq: command.clientSeq, streamId: command.streamId, type: command.type, payload: command.payload, correlationId: command.id, causationId: null, createdAt: null, schemaVersion: SCHEMA_VERSION, reducerVersion: 1 };
}
const canonical = (value: unknown) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export async function deliver(command: Command) {
  if (command.workspace !== settings.workspace || getBackend().auth.currentUser?.uid !== command.actorUid) throw new Error('Account changed. Sign in again to retry.');
  const db = getBackend().db;
  const descriptor = doc(db, descriptorPath(command));
  const target = doc(collection(descriptor, 'events'), command.id);
  if (command.type === 'account/created') {
    try { if ((await getDocFromCache(descriptor)).exists()) return; } catch { /* New account. */ }
  }
  const batch = writeBatch(db);
  batch.set(target, { ...eventFor(command), createdAt: serverTimestamp() });
  const changes = { ownerUid: command.actorUid, version: increment(1), lastEventId: command.id, updatedAt: serverTimestamp() };
  if (['account/created', 'listing/created'].includes(command.type)) batch.set(descriptor, { ...changes, createdAt: serverTimestamp() });
  else batch.update(descriptor, changes);
  try { await batch.commit(); }
  catch (cause) {
    // A retained intent may already have reached the server before a tab closed.
    // Immutable-event rules reject that repeated batch atomically, so the version
    // cannot increment twice. Readback resolves only this acknowledgement ambiguity.
    const existing = await getDocFromServer(target);
    if (existing.exists() && existing.data()?.actorUid === command.actorUid && existing.data()?.type === command.type && canonical(existing.data()?.payload) === canonical(command.payload)) return;
    if (command.type === 'account/created' && (await getDocFromServer(descriptor)).exists()) return;
    throw cause;
  }
}
export function watchDrafts(uid: string, next: (drafts: Descriptor[]) => void, error: (cause: Error) => void) {
  return onSnapshot(collection(getBackend().db, `${accountPath(uid)}/listings`), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.empty && snapshot.metadata.fromCache && navigator.onLine) return;
    next(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Descriptor)).sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0) || (b.updatedAt?.nanoseconds ?? 0) - (a.updatedAt?.nanoseconds ?? 0) || a.id.localeCompare(b.id)));
  }, error);
}
export function watchListing(uid: string, id: string, next: (events: unknown[], confirmed: boolean) => void, error: (cause: Error) => void) {
  return onSnapshot(collection(getBackend().db, `${accountPath(uid)}/listings/${id}/events`), { includeMetadataChanges: true }, snapshot => {
    next(snapshot.docs.map(d => ({ ...d.data(), id: d.id, createdAt: d.metadata.hasPendingWrites ? null : d.data().createdAt })), !snapshot.metadata.fromCache);
  }, error);
}

import type { Command } from './contracts';
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('vintage-delivery-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('identity');
      request.result.createObjectStore('commands', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Device storage is unavailable. Enable site storage and retry.'));
  });
}
export async function allocate(actorUid: string, workspace: string, type: Command['type'], payload: Command['payload'], streamId?: string): Promise<Command> {
  const db = await open();
  return new Promise((resolve, reject) => {
    // IndexedDB serializes read/write transactions across tabs. Identity, sequence
    // and delivery intent commit together, so a refresh cannot reuse an event ID.
    const tx = db.transaction(['identity', 'commands'], 'readwrite');
    const identity = tx.objectStore('identity');
    let command: Command;
    const request = identity.get('device');
    request.onsuccess = () => {
      const device = request.result ?? { id: crypto.randomUUID(), sequence: 0 };
      device.sequence++;
      if (!Number.isSafeInteger(device.sequence)) { tx.abort(); return; }
      identity.put(device, 'device');
      const id = `${actorUid}-${device.id}-${device.sequence}`;
      command = { id, actorUid, workspace, deviceId: device.id, clientSeq: device.sequence, streamId: streamId ?? id, type, payload, status: 'pending' };
      tx.objectStore('commands').put(command);
    };
    tx.oncomplete = () => resolve(command);
    tx.onabort = tx.onerror = () => reject(new Error('Could not save this action on your device. Please retry.'));
  });
}
export async function queued(uid: string, workspace: string): Promise<Command[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('commands').objectStore('commands').getAll();
    request.onsuccess = () => resolve(request.result.filter((c: Command) => c.actorUid === uid && c.workspace === workspace).sort((a: Command, b: Command) => a.clientSeq - b.clientSeq));
    request.onerror = () => reject(request.error);
  });
}
export async function settle(command: Command, rejected = false) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('commands', 'readwrite');
    if (rejected) tx.objectStore('commands').put({ ...command, status: 'rejected' });
    else tx.objectStore('commands').delete(command.id);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

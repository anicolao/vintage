import { writable, get } from 'svelte/store';
import type { User } from 'firebase/auth';
import { observeUser, explain } from '../auth/session';
import { settings } from '../firebase';
import { allocate, queued, settle } from '../events/outbox';
import type { Command, Descriptor, DraftAction } from '../events/contracts';
import { deliver, watchDrafts } from '../repositories/drafts';
interface AppState { user: User | null; resolved: boolean; ready: boolean; error: string; drafts: Descriptor[]; commands: Command[]; sending: boolean }
const empty = (): AppState => ({ user: null, resolved: false, ready: false, error: '', drafts: [], commands: [], sending: false });
export const app = writable<AppState>(empty());
let generation = 0;
let draining: Promise<void> | undefined;
let activeUid: string | undefined;
async function refresh(uid: string, epoch: number) {
  const commands = await queued(uid, settings.workspace);
  if (epoch === generation) app.update(s => ({ ...s, commands }));
}
export function retryDelivery() {
  if (draining) return draining;
  const uid = get(app).user?.uid; const epoch = generation;
  if (!uid) return Promise.resolve();
  const operation = (async () => {
    app.update(s => ({ ...s, sending: true, error: '' }));
    try {
      while (epoch === generation) {
        const command = (await queued(uid, settings.workspace))[0];
        if (!command) break;
        if (epoch !== generation) return;
        try { await deliver(command); await settle(command); }
        catch { await settle(command, true); if (epoch === generation) app.update(s => ({ ...s, error: 'Your change is saved on this device, but hasn’t reached the cloud. Retry when connected.' })); break; }
      }
      await refresh(uid, epoch);
    } catch (cause) { if (epoch === generation) app.update(s => ({ ...s, error: cause instanceof Error ? cause.message : explain(cause) })); }
    finally { if (epoch === generation) app.update(s => ({ ...s, sending: false })); }
  })();
  draining = operation;
  void operation.finally(() => { if (draining === operation) draining = undefined; });
  return operation;
}
export async function dispatch(action: DraftAction, streamId?: string) {
  const current = get(app); const epoch = generation;
  if (!current.user || !current.ready) throw new Error('Wait for your account to connect.');
  const command = await allocate(current.user.uid, settings.workspace, action.type, action.payload, streamId);
  await refresh(current.user.uid, epoch);
  if (epoch !== generation) throw new Error('Account changed. Reopen this draft in the original account.');
  void retryDelivery();
  return command.streamId;
}
export function startSession() {
  let stopDrafts = () => {};
  const stopAuth = observeUser(async user => {
    const epoch = ++generation;
    stopDrafts(); stopDrafts = () => {}; draining = undefined;
    activeUid = user?.uid;
    app.set({ ...empty(), user, resolved: true });
    if (!user) return;
    try {
      const command = await allocate(user.uid, settings.workspace, 'account/created', {}, user.uid);
      if (epoch !== generation) return;
      await deliver(command); await settle(command);
      if (epoch !== generation) return;
      stopDrafts = watchDrafts(user.uid, drafts => {
        if (epoch === generation) app.update(s => ({ ...s, drafts, ready: true }));
      }, cause => { if (epoch === generation) app.update(s => ({ ...s, error: explain(cause) })); });
      await refresh(user.uid, epoch);
      if (epoch === generation) void retryDelivery();
    } catch (cause) { if (epoch === generation) app.update(s => ({ ...s, error: explain(cause) })); }
  }, cause => app.update(s => ({ ...s, resolved: true, error: explain(cause) })));
  const online = () => { if (activeUid) void retryDelivery(); };
  window.addEventListener('online', online);
  return () => { generation++; activeUid = undefined; stopAuth(); stopDrafts(); window.removeEventListener('online', online); app.set(empty()); };
}

export async function discardRejected(streamId: string) {
  const uid = get(app).user?.uid; const epoch = generation;
  if (!uid || get(app).sending) return;
  try {
    for (const command of await queued(uid, settings.workspace)) {
      if (epoch !== generation) return;
      if (command.streamId === streamId && command.status === 'rejected') await settle(command);
    }
    await refresh(uid, epoch);
    if (epoch === generation) app.update(s => ({ ...s, error: '' }));
  } catch { if (epoch === generation) app.update(s => ({ ...s, error: 'Could not remove the local change. Please retry.' })); }
}

import { writable, get } from 'svelte/store';
import type { User } from 'firebase/auth';
import { observeUser, explain } from '../auth/session';
import { settings } from '../firebase';
import { allocate, queued, settle } from '../events/outbox';
import type { Command, Descriptor, DraftAction } from '../events/contracts';
import { deliver, watchDrafts } from '../repositories/drafts';
interface AppState { user: User | null; resolved: boolean; ready: boolean; error: string; drafts: Descriptor[]; commands: Command[]; sending: boolean; listingsLoaded: boolean }
const empty = (): AppState => ({ user: null, resolved: false, ready: false, error: '', drafts: [], commands: [], sending: false, listingsLoaded: false });
export const app = writable<AppState>(empty());
let generation = 0;
const inFlight = new Map<string, Promise<void>>();
let activeUid: string | undefined;
async function refresh(uid: string, epoch: number) {
  const commands = await queued(uid, settings.workspace);
  if (epoch === generation) app.update(s => ({ ...s, commands }));
}
export async function retryDelivery() {
  const uid = get(app).user?.uid; const epoch = generation;
  if (!uid) return;
  const commands = await queued(uid, settings.workspace);
  if (epoch !== generation) return;
  for (const command of commands) {
    if (inFlight.has(command.id)) continue;
    const work = deliver(command).then(() => settle(command)).catch(async () => {
      await settle(command, true);
      if (epoch === generation) app.update(s => ({ ...s, error: 'A change could not sync. You can keep editing and try again.' }));
    }).finally(async () => {
      inFlight.delete(command.id);
      await refresh(uid, epoch);
      if (epoch === generation) app.update(s => ({ ...s, sending: inFlight.size > 0 }));
    });
    inFlight.set(command.id, work);
  }
  if (epoch === generation) app.update(s => ({ ...s, sending: inFlight.size > 0 }));
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
    stopDrafts(); stopDrafts = () => {}; inFlight.clear();
    activeUid = user?.uid;
    app.set({ ...empty(), user, resolved: true, ready: !!user });
    if (!user) return;
    try {
      const command = await allocate(user.uid, settings.workspace, 'account/created', {}, user.uid);
      if (epoch !== generation) return;
      stopDrafts = watchDrafts(user.uid, drafts => {
        if (epoch === generation) app.update(s => ({ ...s, drafts, ready: true, listingsLoaded: true }));
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

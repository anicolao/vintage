export type DraftAction = { type: 'listing/created'; payload: { title: string } } | { type: 'context/changed'; payload: { context: string } };
export interface Command {
  id: string; actorUid: string; deviceId: string; clientSeq: number;
  workspace: string; streamId: string; type: DraftAction['type'] | 'account/created';
  payload: { title?: string; context?: string };
  status: 'pending' | 'rejected';
}
export interface Descriptor { id: string; ownerUid: string; version: number; lastEventId: string }

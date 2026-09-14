export interface Photo {
  id: string; path: string; previewPath: string; type: string;
  size: number; width: number; height: number; digest: string;
}
export type DraftAction =
  | { type: 'listing/created'; payload: { title: string } }
  | { type: 'context/changed'; payload: { context: string } }
  | { type: 'photo/uploaded'; payload: { photo: Photo } }
  | { type: 'photo/replaced'; payload: { photo: Photo; photoId: string } }
  | { type: 'photo/removed'; payload: { photoId: string } }
  | { type: 'photo/reordered'; payload: { photoIds: string[] } };
export interface Command {
  id: string; actorUid: string; deviceId: string; clientSeq: number;
  workspace: string; streamId: string; type: DraftAction['type'] | 'account/created';
  payload: { title?: string; context?: string; photo?: Photo; photoId?: string; photoIds?: string[] };
  status: 'pending' | 'rejected';
}
export interface Descriptor { id: string; ownerUid: string; version: number; lastEventId: string; updatedAt?: {seconds: number; nanoseconds: number} }

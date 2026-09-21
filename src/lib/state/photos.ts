import { writable, get } from 'svelte/store';
import { app, dispatch } from './app';
import { settings } from '../firebase';
import { uploadPhoto, retain, retained, type PendingPhoto } from '../repositories/photos';
export interface PhotoJob { photo: PendingPhoto; url: string; progress: number; error: string; running: boolean; replace: string | null; retryable: boolean }
export const photoJobs = writable<PhotoJob[]>([]);
let processing = false;
const update = () => photoJobs.update(jobs => [...jobs]);
export async function restorePhotos(uid: string, id: string) {
  const photos = await retained(uid, id);
  photoJobs.update(jobs => [...jobs, ...photos.filter(p => !jobs.some(j => j.photo.id === p.id)).map(photo => ({ photo, url: URL.createObjectURL(photo.file), progress: 0, error: '', running: false, retryable: false, replace: photo.replace ?? null }))]);
  void processPhotos();
}
export async function addPhoto(file: File, uid: string, listingId: string, replace: string | null) {
  const photo = { id: crypto.randomUUID(), uid, listingId, workspace: settings.workspace, file, replace };
  const job: PhotoJob = { photo, url: URL.createObjectURL(file), progress: 0, error: '', running: false, retryable: false, replace };
  await retain(photo);
  photoJobs.update(jobs => [...jobs, job]);
  void processPhotos();
}
export async function discardPhoto(job: PhotoJob) {
  if (job.running) return;
  await retain(job.photo, true); URL.revokeObjectURL(job.url);
  photoJobs.update(jobs => jobs.filter(j => j !== job));
}
export function retryPhoto(job: PhotoJob) { job.error = ''; update(); void processPhotos(); }
export async function processPhotos() {
  if (processing) return;
  processing = true;
  try {
    for (;;) {
      const uid = get(app).user?.uid;
      const job = get(photoJobs).find(j => !j.error && j.photo.uid === uid);
      if (!job) break;
      job.running = true; update();
      try {
        const photo = await uploadPhoto(job.photo, progress => { job.progress = progress; update(); });
        if (!get(photoJobs).includes(job)) continue;
        if (get(app).user?.uid !== uid) throw new Error('Sign in to finish uploading this photo.');
        await dispatch(job.replace
          ? { type: 'photo/replaced', payload: { photo, photoId: job.replace } }
          : { type: 'photo/uploaded', payload: { photo } }, job.photo.listingId);
        await retain(job.photo, true); URL.revokeObjectURL(job.url);
        photoJobs.update(jobs => jobs.filter(j => j !== job));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '';
        job.retryable = !/Choose |could not be read|too large|conflicting upload/.test(message);
        job.error = job.retryable ? 'Photo could not sync. Check your connection and try again.' : message;
      }
      finally { job.running = false; update(); }
    }
  } finally { processing = false; }
}

export function resumePhotoUploads() {
  photoJobs.update(jobs => jobs.map(job => { if (job.retryable) job.error = ''; return job; }));
  void processPhotos();
}

export async function discardListingPhotos(uid:string,listingId:string) {
  const jobs=get(photoJobs).filter(j=>j.photo.uid===uid && j.photo.listingId===listingId);
  photoJobs.update(all=>all.filter(j=>!jobs.includes(j)));
  for(const photo of await retained(uid,listingId))await retain(photo,true);
  for(const job of jobs)URL.revokeObjectURL(job.url);
}

import { getBlob, getMetadata, ref, uploadBytesResumable } from 'firebase/storage';
import { getBackend, settings } from '../firebase';
import type { Photo } from '../events/contracts';
export interface PendingPhoto { id: string; uid: string; listingId: string; workspace: string; file: File; replace?: string | null }
let database: Promise<IDBDatabase>;
function open() {
  return database ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('vintage-photos', 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('files')) r.result.createObjectStore('files', { keyPath: 'id' });
      if (!r.result.objectStoreNames.contains('previews')) r.result.createObjectStore('previews');
    };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
export async function retain(photo: PendingPhoto, remove = false) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    if (remove) tx.objectStore('files').delete(photo.id); else tx.objectStore('files').put(photo);
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
export async function retained(uid: string, listingId: string): Promise<PendingPhoto[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db.transaction('files').objectStore('files').getAll();
    r.onsuccess = () => resolve(r.result.filter((p: PendingPhoto) => p.uid === uid && p.listingId === listingId && p.workspace === settings.workspace));
    r.onerror = () => reject(r.error);
  });
}
async function put(path: string, blob: Blob, digest: string, progress: (n: number) => void) {
  const target = ref(getBackend().storage, path);
  try {
    const existing = await getMetadata(target);
    if (existing.customMetadata?.digest !== digest || existing.size !== blob.size) throw new Error('This photo has conflicting upload data. Remove it and select it again.');
    progress(100); return;
  } catch (cause) { if ((cause as {code?: string}).code !== 'storage/object-not-found') throw cause; }
  const upload = uploadBytesResumable(target, blob, { contentType: blob.type, customMetadata: { digest } });
  await new Promise<void>((resolve, reject) => upload.on('state_changed', s => progress(Math.round(s.bytesTransferred / s.totalBytes * 100)), reject, () => resolve()));
}
export async function uploadPhoto(pending: PendingPhoto, progress: (n: number) => void): Promise<Photo> {
  if (getBackend().auth.currentUser?.uid !== pending.uid) throw new Error('Sign in to upload this photo.');
  const file = pending.file;
  const type = /\.hei[cf]$/i.test(file.name) ? 'image/heic' : file.type;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(type)) throw new Error('Choose a JPEG, PNG, WebP or HEIC photo.');
  if (!file.size || file.size > 10485760) throw new Error('Choose a photo smaller than 10 MB.');
  const original = file.type === type ? file : new Blob([file], { type });
  let preview: Blob = original;
  if (/hei[cf]/.test(type)) {
    const { default: convert } = await import('heic2any');
    const result = await convert({ blob: original, toType: 'image/jpeg', quality: .85 });
    preview = Array.isArray(result) ? result[0] : result;
  }
  let dimensions: ImageBitmap;
  try { dimensions = await createImageBitmap(preview); } catch { throw new Error('This photo could not be read. Choose another photo.'); }
  const width = dimensions.width; const height = dimensions.height; dimensions.close();
  if (width > 20000 || height > 20000 || width * height > 60000000 || preview.size > 10485760) throw new Error('This photo is too large. Choose a smaller image.');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await original.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
  const path = `workspaces/${settings.workspace}/accounts/${pending.uid}/listings/${pending.listingId}/photos/${pending.id}/original`;
  const previewPath = preview === original ? path : path.replace(/original$/, 'preview');
  await cachePreview(previewPath, preview);
  if (!navigator.onLine) await new Promise<void>(resolve => window.addEventListener('online', () => resolve(), { once: true }));
  await put(path, original, digest, progress);
  if (preview !== original) await put(previewPath, preview, digest, progress);
  return { id: pending.id, path, previewPath, type, size: original.size, width, height, digest };
}
async function cachePreview(path: string, blob: Blob) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('previews', 'readwrite'); tx.objectStore('previews').put(blob, path);
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
export async function photoUrl(photo: Photo) {
  const uid = getBackend().auth.currentUser?.uid;
  if (!uid || !photo.previewPath.startsWith(`workspaces/${settings.workspace}/accounts/${uid}/`)) throw new Error('Sign in to view this photo.');
  const db = await open();
  const cached = await new Promise<Blob | undefined>((resolve, reject) => {
    const r = db.transaction('previews').objectStore('previews').get(photo.previewPath);
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  if (cached) return URL.createObjectURL(cached);
  const blob = await getBlob(ref(getBackend().storage, photo.previewPath), 10485760);
  await cachePreview(photo.previewPath, blob);
  return URL.createObjectURL(blob);
}

import sharp from 'sharp';
import decode from 'heic-decode';
import { createHash } from 'node:crypto';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function normalizePhoto(bytes, type) {
  let image;
  if (/image\/hei[cf]/.test(type)) {
    const images = await decode.all({ buffer: bytes });
    try {
      const first = images[0];
      if (!first || first.width * first.height > 40000000) throw new Error('Photo dimensions are too large');
      const decoded = await first.decode();
      image = sharp(Buffer.from(decoded.data), { raw: { width: decoded.width, height: decoded.height, channels: 4 }, limitInputPixels: 40000000 });
    } finally { images.dispose(); }
  } else image = sharp(bytes, { limitInputPixels: 40000000 });
  const { data, info } = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height, digest: digest(data), type: 'image/jpeg', normalizerVersion: 1 };
}
export async function ensureDerivative(bucket, photo) {
  const original = bucket.file(photo.path);
  const [bytes] = await original.download();
  if (digest(bytes) !== photo.digest) throw new Error('Photo fingerprint does not match its original');
  const path = photo.path.replace(/original$/, 'analysis-v1');
  const derivative = await normalizePhoto(bytes, photo.type);
  try {
    await bucket.file(path).save(derivative.bytes, { resumable: false, contentType: derivative.type, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { originalDigest: photo.digest, digest: derivative.digest, normalizerVersion: '1' } } });
  } catch (error) { if (Number(error.code) !== 412) throw error; }
  const { bytes: _, ...metadata } = derivative;
  return { path, ...metadata };
}

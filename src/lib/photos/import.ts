export class PhotoImportError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) { super(message); this.retryable = retryable; }
}

// Phone exports can retain a HEIC filename after transcoding to JPEG. Inspect
// common readable formats before trusting that extension or the supplied MIME.
export async function photoType(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return 'image/png';
  const text = new TextDecoder().decode(bytes);
  if (text.startsWith('RIFF') && text.slice(8) === 'WEBP') return 'image/webp';
  return /\.hei[cf]$/i.test(file.name) ? 'image/heic' : file.type;
}

type Converter = (options: {blob: Blob; toType: string; quality: number}) => Promise<Blob | Blob[]>;
export async function heicPreview(original: Blob, load: () => Promise<Converter> = async () => (await import('heic2any')).default): Promise<Blob> {
  let convert: Converter;
  try { convert = await load(); }
  catch { throw new PhotoImportError('The HEIC converter could not load. Reconnect and try again; your selected photo is saved on this device.', true); }
  try {
    const result = await convert({blob: original, toType: 'image/jpeg', quality: .85});
    const preview = Array.isArray(result) ? result[0] : result;
    if (!(preview instanceof Blob) || !preview.size) throw new Error('Empty conversion');
    return preview;
  } catch {
    // heic2any also rejects with {code, message}, not just Error instances.
    throw new PhotoImportError('This HEIC photo could not be converted. It may use an unsupported HEIC format or be damaged. Export it as JPEG or PNG and select that copy, or take a new photo.');
  }
}

export function photoFailure(cause: unknown): {message: string; retryable: boolean} {
  if (cause instanceof PhotoImportError) return {message: cause.message, retryable: cause.retryable};
  const error = cause as {code?: string; name?: string} | null;
  if (error?.name === 'QuotaExceededError') return {message: 'This device has insufficient storage to save the photo. Free some space and try again.', retryable: true};
  if (['storage/unauthenticated', 'storage/unauthorized', 'permission-denied', 'unauthenticated'].includes(error?.code || '')) {
    return {message: 'Photo access was denied. Check that you are signed in to the account that owns this listing, then try again.', retryable: true};
  }
  if (['storage/retry-limit-exceeded', 'storage/network-request-failed', 'unavailable', 'deadline-exceeded'].includes(error?.code || '')) {
    return {message: 'Photo could not sync. Check your connection and try again.', retryable: true};
  }
  return {message: 'The photo could not be saved or uploaded. Try again. If it keeps failing, select another photo.', retryable: true};
}

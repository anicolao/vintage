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
  if(text.slice(4,8)==='ftyp'&&['heic','heix','hevc','hevx','mif1','msf1'].includes(text.slice(8,12)))return 'image/heic';
  return /\.hei[cf]$/i.test(file.name) ? 'image/heic' : file.type;
}

export const maxPhotoBytes=50*1024*1024;
export const maxPhotoPixels=60000000;
type Converter = (options: {blob: Blob; type: 'bitmap'}) => Promise<ImageBitmap>;
async function jpegPreview(bitmap:ImageBitmap):Promise<Blob> {
  try {
    if(bitmap.width*bitmap.height>maxPhotoPixels)throw new PhotoImportError('Choose a photo up to 60 megapixels.');
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    try {
      const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Empty preview')),'image/jpeg',.85));
    }finally{canvas.width=canvas.height=1;}
  }finally{bitmap.close();}
}
async function nativePhoto(blob:Blob):Promise<ImageBitmap> {
  try {return await createImageBitmap(blob);}catch {
    const url=URL.createObjectURL(blob);const image=new Image();
    try {image.src=url;await image.decode();return await createImageBitmap(image);}
    finally {image.src='';URL.revokeObjectURL(url);}
  }
}
export async function heicPreview(original: Blob, load: () => Promise<Converter> = async () => (await import('heic-to/next')).heicTo as Converter, native: (blob:Blob)=>Promise<ImageBitmap> = nativePhoto, render: (bitmap:ImageBitmap)=>Promise<Blob> = jpegPreview): Promise<Blob> {
  // Use the phone's native image codec when available. Other browsers use the
  // maintained HEIF decoder in a worker, keeping navigation responsive.
  let bitmap:ImageBitmap|undefined;
  try {bitmap=await native(original);}catch { /* This browser needs the HEIF codec. */ }
  if(!bitmap) {
    let convert:Converter;
    try {convert=await load();}
    catch {throw new PhotoImportError('Photo support could not load. Reconnect and try again; your original is saved on this phone.',true);}
    try {bitmap=await convert({blob:original,type:'bitmap'});}
    catch {throw new PhotoImportError('This HEIC photo could not be read. Your original is saved on this phone. Try selecting the original from Photos again.');}
  }
  if(!bitmap?.width||!bitmap?.height)throw new PhotoImportError('This HEIC photo contains no readable image. Select the original from Photos again.');
  return render(bitmap);
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

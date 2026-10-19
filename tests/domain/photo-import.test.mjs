import {test} from 'node:test';
import assert from 'node:assert/strict';
import {heicPreview, photoType, photoFailure, PhotoImportError} from '../../src/lib/photos/import.ts';

test('HEIC decoder object rejection is actionable and never a connection retry',async()=>{
  let failure;
  try {await heicPreview(new Blob(['heic']),async()=>async()=>{throw {code:2,message:'ERR_LIBHEIF format not supported'};});}catch(error){failure=photoFailure(error);}
  assert.equal(failure.retryable,false);
  assert.match(failure.message,/HEIC.*could not be converted/);
  assert.match(failure.message,/JPEG or PNG/);
  assert.doesNotMatch(failure.message,/connection|ERR_LIBHEIF/);
});
test('converter loading failures are distinct and retryable',async()=>{
  await assert.rejects(()=>heicPreview(new Blob(['heic']),async()=>{throw new TypeError('Failed to fetch dynamically imported module');}),error=>{
    assert.equal(photoFailure(error).retryable,true);assert.match(error.message,/converter could not load/);return true;
  });
});
test('empty conversion is rejected; a decoded first image is returned',async()=>{
  for(const output of [[],new Blob([])])await assert.rejects(()=>heicPreview(new Blob(['heic']),async()=>async()=>output),PhotoImportError);
  const jpeg=new Blob(['jpeg'],{type:'image/jpeg'});
  assert.equal(await heicPreview(new Blob(['heic']),async()=>async()=>[jpeg]),jpeg);
});
test('JPEG bytes with HEIC filename or MIME bypass HEIC decoding',async()=>{
  assert.equal(await photoType(new File([new Uint8Array([255,216,255,224])],'IMG.HEIC',{type:'image/heic'})),'image/jpeg');
  assert.equal(await photoType(new File(['\0\0\0\0ftypheic'],'IMG.HEIC')),'image/heic');
  assert.equal(await photoType(new File(['\0\0\0\0ftypheif'],'photo',{type:'image/heif'})),'image/heif');
});
test('permission and device errors do not blame the connection; validation stays terminal',()=>{
  assert.match(photoFailure({code:'storage/unauthorized'}).message,/access was denied/);
  assert.match(photoFailure({name:'QuotaExceededError'}).message,/insufficient storage/);
  assert.match(photoFailure({code:'storage/retry-limit-exceeded'}).message,/connection/);
  assert.doesNotMatch(photoFailure({message:'decoder failed'}).message,/connection/);
  assert.deepEqual(photoFailure(new PhotoImportError('Choose a smaller photo.')),{message:'Choose a smaller photo.',retryable:false});
});

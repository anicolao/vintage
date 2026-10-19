import {test} from 'node:test';
import assert from 'node:assert/strict';
import {heicPreview,photoType,photoFailure,PhotoImportError,maxPhotoBytes,maxPhotoPixels} from '../../src/lib/photos/import.ts';
const unsupported=async()=>{throw new Error('No native HEIF codec');};
const bitmap={width:8064,height:6048,close(){}};
const jpeg=new Blob(['jpeg'],{type:'image/jpeg'});
test('native iPhone image decoding avoids loading another codec',async()=>{
 assert.equal(await heicPreview(new Blob(['heic']),()=>assert.fail('Native decoding should suffice'),async()=>bitmap,async b=>{assert.equal(b,bitmap);return jpeg;}),jpeg);
 assert.ok(bitmap.width*bitmap.height<=maxPhotoPixels);assert.equal(maxPhotoBytes,50*1024*1024);
});
test('browser without native HEIF decoding uses maintained bitmap converter',async()=>{
 assert.equal(await heicPreview(new Blob(['heic']),async()=>async options=>{assert.equal(options.type,'bitmap');return bitmap;},unsupported,async()=>jpeg),jpeg);
});
test('damaged HEIC errors retain original and do not require manual JPEG conversion',async()=>{
 await assert.rejects(()=>heicPreview(new Blob(['heic']),async()=>async()=>{throw {code:2};},unsupported),error=>{
  assert.equal(photoFailure(error).retryable,false);assert.match(error.message,/original is saved/);assert.doesNotMatch(error.message,/Export|JPEG|connection/);return true;
 });
});
test('converter loading failures are distinct and retryable',async()=>{
 await assert.rejects(()=>heicPreview(new Blob(['heic']),async()=>{throw Error('Failed import');},unsupported),error=>{assert.equal(photoFailure(error).retryable,true);return true;});
});
test('HEIC detection reads content even with absent or incorrect metadata',async()=>{
 assert.equal(await photoType(new File([new Uint8Array([255,216,255,224])],'IMG.HEIC',{type:'image/heic'})),'image/jpeg');
 for(const brand of ['heic','heix','hevc','hevx','mif1','msf1'])assert.equal(await photoType(new File(['\0\0\0\0ftyp'+brand],'photo',{type:'application/octet-stream'})),'image/heic');
});
test('permission and device errors stay actionable',()=>{
 assert.match(photoFailure({code:'storage/unauthorized'}).message,/access was denied/);
 assert.match(photoFailure({name:'QuotaExceededError'}).message,/insufficient storage/);
 assert.match(photoFailure({code:'storage/retry-limit-exceeded'}).message,/connection/);
 assert.deepEqual(photoFailure(new PhotoImportError('Choose a smaller photo.')),{message:'Choose a smaller photo.',retryable:false});
});

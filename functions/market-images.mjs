import sharp from 'sharp';
import {createHash} from 'node:crypto';
export function marketImageUrl(value) {
 try {const u=new URL(value);return u.protocol==='https:'&&u.hostname==='i.ebayimg.com'&&!u.port&&!u.username&&!u.password&&u.pathname.startsWith('/images/')?u.href:null;} catch{return null;}
}
export async function loadMarketImage(url,transport=fetch) {
 if(!marketImageUrl(url))return null;
 try {
  const response=await transport(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return null;
  const chunks=[];let size=0;
  const reader=response.body.getReader();
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024)return null;chunks.push(value);}}finally{await reader.cancel();}
  const bytes=await sharp(Buffer.concat(chunks),{limitInputPixels:20000000}).rotate().resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toBuffer();
  return {bytes,digest:createHash('sha256').update(bytes).digest('hex')};
 }catch{return null;}
}
export const imagePart=bytes=>({inlineData:{mimeType:'image/jpeg',data:bytes.toString('base64')}});

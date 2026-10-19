import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {deletionEndpoint} from '../functions/ebay-deletion.mjs';
const defaultRoot=new URL('../.cache/ebay/',import.meta.url);
export async function syncDeletions({root=defaultRoot,transport=fetch}={}) {
 const response=await transport(deletionEndpoint,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
 if(!response.ok)throw new Error('Cannot synchronize eBay deletions.');
 const {revision}=await response.json();
 if(!Number.isSafeInteger(revision)||revision<0)throw new Error('Invalid deletion revision.');
 await mkdir(root,{recursive:true,mode:0o700});
 const marker=new URL('deletion-revision.json',root);
 let previous=null;
 try{previous=JSON.parse(await readFile(marker,'utf8')).revision;}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
 let removed=0;
 if(previous!==revision){
  for(const entry of await readdir(root,{withFileTypes:true})){
   if(entry.name.startsWith('run-')&&entry.isDirectory()) {await rm(new URL(entry.name+'/',root),{recursive:true,force:true});removed++;}
  }
  await writeFile(marker,JSON.stringify({revision})+'\n',{mode:0o600});
 }
 return {revision,removed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const watch=process.argv.slice(2).join(' ')==='--watch';
 if(process.argv.length>2&&!watch){console.error('Usage: npm run ebay:sync-deletions -- [--watch]');process.exitCode=2;}
 else {
  do {
   try{const r=await syncDeletions();console.log(`Deletion revision ${r.revision}; removed ${r.removed} cached runs.`);}
   catch{console.error('Deletion synchronization failed; retained files still need cleanup.');if(!watch){process.exitCode=1;break;}}
   if(watch)await new Promise(resolve=>setTimeout(resolve,60000));
  }while(watch);
 }
}

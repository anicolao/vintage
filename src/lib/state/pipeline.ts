import { writable, derived, get } from 'svelte/store';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { app, discardLocalDraft } from './app';
import { photoJobs, discardListingPhotos } from './photos';
import { getBackend, settings } from '../firebase';
import { accountPath } from '../repositories/drafts';
import type { Photo } from '../events/contracts';
export const listingFields = ['title','description','category','brand','size','colour','material','condition'] as const;
export type ListingField = typeof listingFields[number];
export type Copy = Record<ListingField,string>;
export interface Money { currency:'GBP'; minor:number }
export interface Model {provider:'vertex-ai';model:string;promptVersion:string}
export interface Instruction {id:string;text:string}
export interface Proposal {schemaVersion:2;copy:Copy;confidence:Record<ListingField,number>;observations:{text:string;photoIds:string[]}[];model:Model;inputFingerprint:string}
export interface Snapshot {copy:Copy;price:Money;photos:Photo[];proposalId:string;model:Model}
export interface Workflow {version:number;status:string;proposal:Proposal|null;proposalId:string;copy:Copy|null;price:Money|null;approved:Snapshot|null;input:{photos:Photo[];context:string;instructions:Instruction[];baseVersion:number}|null;revision?:{id:string;status:string;text:string}|null;error:string;stage?:number;updatedAt?:string;lastCommandId?:string}
export type Request =
  | {kind:'feedback';listingId:string;expectedVersion:number;text:string;previousCopy:Pick<Copy,'title'|'description'>}
  | {kind:'forget';listingId:string;expectedVersion:number;instructionId:string}
  | {kind:'generate';listingId:string;expectedVersion:number;photoIds:string[];context:string;replace:boolean}
  | {kind:'edit';listingId:string;expectedVersion:number;field:ListingField;value:string;previousValue:string}
  | {kind:'price';listingId:string;expectedVersion:number;price:Money|null}
  | {kind:'save'|'reopen';listingId:string;expectedVersion:number}
  | {kind:'duplicate';listingId:string;expectedVersion:0;sourceListingId:string;sourceVersion:number}
  | {kind:'approve';listingId:string;expectedVersion:number;baseVersion:number;snapshot:Snapshot};
interface Intent { commandId:string;request:Request;error:string;delivering?:boolean;seed?:Workflow }
// Capture projections for a duplicate are durable on the device before its
// independent Storage objects and Firestore stream are published by the server.
export function duplicateEvents(intents:Intent[],listingId:string,owner:string) {
  const intent=intents.find(i=>i.request.kind==='duplicate' && i.request.listingId===listingId);
  const input=intent?.seed?.input;if(!intent || !input)return [];
  return [{type:'listing/created',payload:{title:'Item'}},{type:'context/changed',payload:{context:input.context}},...input.photos.map(photo=>({type:'photo/uploaded',payload:{photo}}))].map((event,index)=>({...event,id:`${intent.commandId}-${index}`,streamId:listingId,actorUid:owner,deviceId:'server',clientSeq:index+1,correlationId:intent.commandId,causationId:null,createdAt:{seconds:0,nanoseconds:index},schemaVersion:2,reducerVersion:1}));
}
export const emptyWorkflow = ():Workflow=>({version:0,status:'draft',proposal:null,proposalId:'',copy:null,price:null,approved:null,input:null,error:''});
const cloudWorkflows=writable<Record<string,Workflow>>({});
export const pipelineIntents=writable<Intent[]>([]);
export const pipelineRestored=writable(false);
const cloudInstructions=writable<Instruction[]>([]);
export const instructions=derived([cloudInstructions,pipelineIntents],([$cloud,$intents])=>{
  let result=[...$cloud];
  for(const {request,commandId} of $intents){
    if(request.kind==='feedback' && !result.some(i=>i.id===commandId))result=[...result.filter(i=>i.text!==request.text),{id:commandId,text:request.text}];
    if(request.kind==='forget')result=result.filter(i=>i.id!==request.instructionId);
  }
  return result;
});
export const pipelineError=writable('');
export const pipelineSaving=writable(0);
export const connection=writable(true);
let uid=''; let epoch=0; let sending=false; let persisting=Promise.resolve();
let database:Promise<IDBDatabase>;
function openDB() {
  return database ??= new Promise((resolve,reject)=>{
    const r=indexedDB.open('vintage-pipeline',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('queues');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
let channel:BroadcastChannel | undefined;
async function changeQueue(owner:string, change:(items:Intent[])=>Intent[]) {
  const db=await openDB();
  const next=await new Promise<Intent[]>((resolve,reject)=>{
    const tx=db.transaction('queues','readwrite'); const store=tx.objectStore('queues');
    const key=`${settings.workspace}/${owner}`; const read=store.get(key); let result:Intent[];
    read.onsuccess=()=>{result=change(read.result || []);store.put(result,key);};
    tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error);
  });
  if(owner===uid)pipelineIntents.set(next);
  channel?.postMessage({owner});
  return next;
}
async function readQueue(owner:string) {
  const db=await openDB();
  return new Promise<Intent[]>((resolve,reject)=>{const r=db.transaction('queues').objectStore('queues').get(`${settings.workspace}/${owner}`);r.onsuccess=()=>resolve(r.result || []);r.onerror=()=>reject(r.error);});
}
async function cachedWorkflows(owner:string):Promise<Record<string,Workflow>> {
  const db=await openDB();
  return new Promise((resolve,reject)=>{const r=db.transaction('queues').objectStore('queues').get(`states/${settings.workspace}/${owner}`);r.onsuccess=()=>resolve(r.result || {});r.onerror=()=>reject(r.error);});
}
async function rememberWorkflow(owner:string,id:string,state:Workflow) {
  const db=await openDB();
  const saved=await new Promise<Workflow>((resolve,reject)=>{
    const tx=db.transaction('queues','readwrite');const store=tx.objectStore('queues');
    const key=`states/${settings.workspace}/${owner}`;const read=store.get(key);let next:Workflow;
    read.onsuccess=()=>{const all=read.result || {};next=(all[id]?.version ?? -1)>state.version ? all[id] : state;store.put({...all,[id]:next},key);};
    tx.oncomplete=()=>resolve(next);tx.onerror=tx.onabort=()=>reject(tx.error);
  });
  if(owner===uid)cloudWorkflows.update(all=>({...all,[id]:(all[id]?.version ?? -1)>saved.version ? all[id] : saved}));
}
export const workflows=derived([cloudWorkflows,pipelineIntents],([$cloud,$intents])=>{
  const all={...$cloud};
  for (const intent of $intents) {
    const r=intent.request;if (!('listingId' in r)) continue;
    let state={...(all[r.listingId] || emptyWorkflow())};
    if ($cloud[r.listingId]?.lastCommandId===intent.commandId) continue;
    if (r.kind==='duplicate' && intent.seed) state={...intent.seed,version:0,status:'saved',approved:null,revision:null};
    if (r.kind==='save') state.status='saved';
    if (r.kind==='reopen') state={...state,status:'reviewing',approved:null,revision:null};
    if (r.kind==='edit' && state.copy) state.copy={...state.copy,[r.field]:r.value};
    if (r.kind==='feedback') state={...state,revision:{id:intent.commandId,status:'pending',text:r.text}};
    if (r.kind==='price') state.price=r.price;
    if (r.kind==='generate') state={...state,status:'generating',stage:0,revision:null};
    if (r.kind==='approve') state={...state,status:'approval-pending',approved:r.snapshot};
    state.version++;all[r.listingId]=state;
  }
  return all;
});
export async function enqueue(request:Request,seed?:Workflow) {
  const owner=uid; const current=epoch;if (!owner) throw new Error('Sign in to continue.');
  pipelineSaving.update(n=>n+1);
  // Serialize device persistence, but never await a network acknowledgement.
  const work=persisting.then(async()=>{
    const intents=await changeQueue(owner, previous=>{
      const intents=[...previous];
      const server=get(cloudWorkflows)[request.listingId] || emptyWorkflow();
      const matching=intents.filter(i=>(i.request.listingId===request.listingId) && i.commandId!==server.lastCommandId);
      if (request.kind==='edit' || request.kind==='price' || request.kind==='feedback' || request.kind==='forget' || request.kind==='save' || request.kind==='reopen') request={...request,expectedVersion:server.version+matching.length};
      const last=intents.at(-1);
      if (last && !last.delivering && !last.error &&
        (request.kind==='edit' && last.request.kind==='edit' && request.listingId===last.request.listingId && request.field===last.request.field)) {
        request={...request,expectedVersion:last.request.expectedVersion};
        if(request.kind==='edit' && last.request.kind==='edit') request.previousValue=last.request.previousValue;
        intents[intents.length-1]={...last,request};
      } else intents.push({commandId:request.kind==='duplicate' ? request.listingId : crypto.randomUUID(),request,error:'',...(seed ? {seed}: {})});
      return intents;
    });
    if (current!==epoch) return;
    pipelineIntents.set(intents);pipelineError.set('');void flush();
  });
  persisting=work.catch(()=>{});
  try {await work;} catch {pipelineError.set('Not saved on this phone. Free some space and try again.');throw new Error('Device storage unavailable');}finally{pipelineSaving.update(n=>n-1);}
}
export const locallyPersisted = () => persisting;
let inFlightId='';
export async function flush() {
  if (sending || !uid || !navigator.onLine) return;
  sending=true;const current=epoch;const owner=uid;
  try {
    // The browser releases this lock if a tab closes. Other tabs take over the
    // same durable queue without duplicate transactions or lease-expiry sleeps.
    await navigator.locks.request(`vintage-pipeline/${settings.workspace}/${owner}`,async()=>{
      if(current!==epoch)return;
      const intents=await readQueue(owner);if(current!==epoch)return;
      pipelineIntents.set(intents);await deliverQueue();
    });
  } catch { if(current===epoch)pipelineError.set('Device storage could not be opened for synchronization. Try again.'); } finally {sending=false;}
}
async function deliverQueue() {
  const current=epoch;const owner=uid;
  try {
    for (;;) {
      if (current!==epoch || !navigator.onLine) break;
      const intent=get(pipelineIntents)[0];if (!intent || intent.error) break;
      // Capture remains responsive while prerequisites sync. The request keeps
      // the originally selected photo IDs and context, even if editing continues.
      const needsCapture=intent.request.kind==='generate' || intent.request.kind==='approve';
      if (needsCapture && (get(app).commands.some(c=>c.streamId===intent.request.listingId) || get(photoJobs).some(j=>j.photo.uid===owner && j.photo.listingId===intent.request.listingId))) break;
      inFlightId=intent.commandId;
      try {
        const claimed=await changeQueue(owner,items=>items.map(i=>i.commandId===intent.commandId ? {...i,delivering:true}:i));
        const ready=claimed.find(i=>i.commandId===intent.commandId);
        if (!ready) continue;
        intent.request=ready.request;
        const result=await httpsCallable<{workspace:string;commandId:string;request:Request},{state:Workflow}>(getBackend().functions,'submitCommand')({workspace:settings.workspace,commandId:intent.commandId,request:intent.request});
        if (current!==epoch) break;
        const server=result.data.state;
        if ('listingId' in intent.request) {
          const listingId=intent.request.listingId;
          // Persist the acknowledgement before retiring intent. Firestore's
          // separate cache can still contain an older version during reload.
          await rememberWorkflow(owner,listingId,server);
        }
        // Chain removals with enqueues so rapid input cannot resurrect a settled request.
        const remove=persisting.then(async()=>{
          await changeQueue(owner,items=>items.filter(i=>i.commandId!==intent.commandId));
        });
        persisting=remove.catch(()=>{});await remove;
      } catch (cause) {
        if (current!==epoch) break;
        const error=cause as {code?:string;message?:string};
        if (['functions/unavailable','functions/deadline-exceeded','functions/internal'].includes(error.code || '')) {pipelineError.set('This change could not sync. Your work is saved on this phone. Try again.');break;}
        const message=error.message || 'This version could not sync. Review the latest version.';
        await changeQueue(owner,items=>items.map(i=>i.commandId===intent.commandId ? {...i,error:message}:i));break;
      } finally {inFlightId='';}
    }
  } finally {inFlightId='';}
}
export async function useLatest() {
  const conflict=get(pipelineIntents).find(i=>i.error);
  if(conflict?.request.kind==='duplicate') {
    await discardListingPhotos(uid,conflict.request.listingId);
    await discardLocalDraft(conflict.request.listingId);
  }
  let target='';
  await changeQueue(uid,items=>{
    const conflict=items.find(i=>i.error);if(!conflict)return items;
    target=conflict.request.listingId;
    return items.filter(i=>i.request.listingId!==target);
  });
  pipelineError.set('');void flush();
}
export function watchWorkflow(owner:string,id:string) {
  const current=epoch;
  return onSnapshot(doc(getBackend().db,`${accountPath(owner)}/listings/${id}/pipeline/state`),snapshot=>{
    if (current!==epoch) return;
    const next=(snapshot.data() || emptyWorkflow()) as Workflow;
    void rememberWorkflow(owner,id,next).catch(()=>pipelineError.set('The review could not be saved on this phone. Try again.'));
  },()=>pipelineError.set('The saved review could not be opened. Try again.'));
}
export function startPipeline() {
  channel=new BroadcastChannel('vintage-pipeline');
  channel.onmessage=async event=>{const owner=uid;const current=epoch;if(event.data.owner!==owner)return;const intents=await readQueue(owner);if(current===epoch){pipelineIntents.set(intents);void flush();}};
  let stopInstructions=()=>{};
  const stop=app.subscribe(state=>{
    if ((state.user?.uid || '')===uid) {void flush();return;}
    uid=state.user?.uid || '';pipelineRestored.set(false);const current=++epoch;stopInstructions();cloudInstructions.set([]);pipelineIntents.set([]);cloudWorkflows.set({});pipelineError.set('');
    if (!uid) return;
    const owner=uid;
    stopInstructions=onSnapshot(doc(getBackend().db,`${accountPath(uid)}/language/state`),snapshot=>{if(current===epoch)cloudInstructions.set(snapshot.data()?.instructions || []);},()=>pipelineError.set('Saved language feedback could not be opened. Try again.'));
    void Promise.all([readQueue(owner),cachedWorkflows(owner)]).then(([intents,cached])=>{if(current===epoch){cloudWorkflows.update(all=>({...cached,...Object.fromEntries(Object.entries(all).map(([id,state])=>[id,(cached[id]?.version ?? -1)>state.version ? cached[id] : state]))}));pipelineIntents.set(intents);pipelineRestored.set(true);void flush();}}).catch(()=>pipelineError.set('Device storage is unavailable. Your unsynced work could not be opened.'));
  });
  const stopPhotos=photoJobs.subscribe(()=>void flush());
  const online=()=>{connection.set(navigator.onLine);void flush();};online();
  const leaving=(event:BeforeUnloadEvent)=>{if(get(pipelineSaving)>0){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',leaving);
  window.addEventListener('online',online);window.addEventListener('offline',online);
  return ()=>{channel?.close();channel=undefined;stop();stopInstructions();stopPhotos();uid='';epoch++;window.removeEventListener('beforeunload',leaving);window.removeEventListener('online',online);window.removeEventListener('offline',online);};
}

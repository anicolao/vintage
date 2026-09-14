import { writable, derived, get } from 'svelte/store';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { app } from './app';
import { photoJobs } from './photos';
import { getBackend, settings } from '../firebase';
import { accountPath } from '../repositories/drafts';
import type { Photo } from '../events/contracts';
export const listingFields = ['title','description','category','brand','size','colour','material','condition'] as const;
export type ListingField = typeof listingFields[number];
export type Copy = Record<ListingField,string>;
export interface Money { currency:'GBP'; minor:number }
export interface Example { id:string; title:string; description:string }
export interface Proposal { sample:true; copy:Copy; confidence:Record<ListingField,number>; observations:string[]; pricing:{recommended:Money;expectedSaleRange:null;rationale:string}; evidence:{id:string;kind:string;label:string;sourceIds:string[];unavailable:boolean}[] }
export interface Snapshot { copy:Copy; price:Money; photos:Photo[]; proposalId:string; sample:true }
export interface Workflow { version:number; status:string; proposal:Proposal|null; proposalId:string; copy:Copy|null; price:Money|null; approved:Snapshot|null; input:{photos:Photo[];context:string;examples:Example[];baseVersion:number}|null; error:string; stage?:number; updatedAt?:string; lastCommandId?:string }
export interface Style { version:number; examples:Example[]; profile:{sample:true;summary:string}|null; status:string; stage:number; error:string; lastCommandId?:string }
export type Request =
  | {kind:'examples';examples:Example[];previousExamples:Example[];expectedVersion:number}
  | {kind:'learn';expectedVersion:number}
  | {kind:'generate';listingId:string;expectedVersion:number;photoIds:string[];context:string;styleVersion:number;replace:boolean}
  | {kind:'edit';listingId:string;expectedVersion:number;field:ListingField;value:string;previousValue:string}
  | {kind:'price';listingId:string;expectedVersion:number;price:Money}
  | {kind:'approve';listingId:string;expectedVersion:number;baseVersion:number;snapshot:Snapshot};
interface Intent { commandId:string;request:Request;error:string;delivering?:boolean }
const emptyStyle = ():Style=>({version:0,examples:[],profile:null,status:'empty',stage:0,error:''});
export const emptyWorkflow = ():Workflow=>({version:0,status:'draft',proposal:null,proposalId:'',copy:null,price:null,approved:null,input:null,error:''});
const cloudStyle=writable<Style>(emptyStyle());
const cloudWorkflows=writable<Record<string,Workflow>>({});
export const pipelineIntents=writable<Intent[]>([]);
export const pipelineError=writable('');
export const pipelineSaving=writable(0);
export const pipelineResolution=writable('');
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
export const style=derived([cloudStyle,pipelineIntents],([$cloud,$intents])=>{
  let state={...$cloud};
  for (const intent of $intents.filter(i=>!('listingId' in i.request))) {
    const r=intent.request;
    if ($cloud.lastCommandId===intent.commandId) continue;
    if (r.kind==='examples') state={...state,examples:r.examples,profile:null,status:'needs-learning'};
    if (r.kind==='learn') state={...state,status:'learning',stage:0};
    state.version++;
  }
  return state;
});
export const workflows=derived([cloudWorkflows,pipelineIntents],([$cloud,$intents])=>{
  const all={...$cloud};
  for (const intent of $intents) {
    const r=intent.request;if (!('listingId' in r)) continue;
    let state={...(all[r.listingId] || emptyWorkflow())};
    if ($cloud[r.listingId]?.lastCommandId===intent.commandId) continue;
    if (r.kind==='edit' && state.copy) state.copy={...state.copy,[r.field]:r.value};
    if (r.kind==='price') state.price=r.price;
    if (r.kind==='generate') state={...state,status:'generating',stage:0};
    if (r.kind==='approve') state={...state,status:'approval-pending',approved:r.snapshot};
    state.version++;all[r.listingId]=state;
  }
  return all;
});
export async function enqueue(request:Request) {
  const owner=uid; const current=epoch;if (!owner) throw new Error('Sign in to continue.');
  pipelineSaving.update(n=>n+1);
  // Serialize device persistence, but never await a network acknowledgement.
  const work=persisting.then(async()=>{
    const intents=await changeQueue(owner, previous=>{
      const intents=[...previous];
      const server='listingId' in request ? get(cloudWorkflows)[request.listingId] || emptyWorkflow() : get(cloudStyle);
      const matching=intents.filter(i=>('listingId' in request ? 'listingId' in i.request && i.request.listingId===request.listingId : !('listingId' in i.request)) && i.commandId!==server.lastCommandId);
      if (request.kind==='examples' || request.kind==='edit' || request.kind==='price') request={...request,expectedVersion:server.version+matching.length};
      const last=intents.at(-1);
      if (last && !last.delivering && !last.error &&
        ((request.kind==='examples' && last.request.kind==='examples') ||
         (request.kind==='edit' && last.request.kind==='edit' && request.listingId===last.request.listingId && request.field===last.request.field))) {
        request={...request,expectedVersion:last.request.expectedVersion};
        if(request.kind==='edit' && last.request.kind==='edit') request.previousValue=last.request.previousValue;
        if(request.kind==='examples' && last.request.kind==='examples') request.previousExamples=last.request.previousExamples;
        intents[intents.length-1]={...last,request};
      } else intents.push({commandId:crypto.randomUUID(),request,error:''});
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
      if (get(app).commands.length || get(photoJobs).some(j=>j.photo.uid===owner)) break;
      inFlightId=intent.commandId;
      try {
        const claimed=await changeQueue(owner,items=>items.map(i=>i.commandId===intent.commandId ? {...i,delivering:true}:i));
        const ready=claimed.find(i=>i.commandId===intent.commandId);
        if (!ready) continue;
        intent.request=ready.request;
        const result=await httpsCallable<{workspace:string;commandId:string;request:Request},{state:Style|Workflow}>(getBackend().functions,'submitCommand')({workspace:settings.workspace,commandId:intent.commandId,request:intent.request});
        if (current!==epoch) break;
        const server=result.data.state;
        if ('listingId' in intent.request) {
          const listingId=intent.request.listingId;
          cloudWorkflows.update(all=>({...all,[listingId]:(all[listingId]?.version ?? -1)>server.version ? all[listingId] : server as Workflow}));
        } else cloudStyle.update(state=>state.version>server.version ? state : server as Style);
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
  let target='';
  await changeQueue(uid,items=>{
    const conflict=items.find(i=>i.error);if(!conflict)return items;
    target='listingId' in conflict.request ? conflict.request.listingId : 'style';
    return items.filter(i=>('listingId' in i.request ? i.request.listingId : 'style')!==target);
  });
  pipelineError.set('');pipelineResolution.set(`${target}/${crypto.randomUUID()}`);void flush();
}
export function watchWorkflow(owner:string,id:string) {
  const current=epoch;
  return onSnapshot(doc(getBackend().db,`${accountPath(owner)}/listings/${id}/pipeline/state`),snapshot=>{
    if (current!==epoch) return;
    const next=(snapshot.data() || emptyWorkflow()) as Workflow;
    cloudWorkflows.update(all=>({...all,[id]:(all[id]?.version ?? -1)>next.version ? all[id] : next}));
  },()=>pipelineError.set('The saved review could not be opened. Try again.'));
}
export function startPipeline() {
  channel=new BroadcastChannel('vintage-pipeline');
  channel.onmessage=async event=>{const owner=uid;const current=epoch;if(event.data.owner!==owner)return;const intents=await readQueue(owner);if(current===epoch){pipelineIntents.set(intents);void flush();}};
  let stopStyle=()=>{};
  const stop=app.subscribe(state=>{
    if ((state.user?.uid || '')===uid) {void flush();return;}
    uid=state.user?.uid || '';const current=++epoch;stopStyle();pipelineIntents.set([]);cloudStyle.set(emptyStyle());cloudWorkflows.set({});pipelineError.set('');
    if (!uid) return;
    const owner=uid;
    stopStyle=onSnapshot(doc(getBackend().db,`${accountPath(uid)}/style/state`),s=>{if(current===epoch){const next=(s.data() || emptyStyle()) as Style;cloudStyle.update(state=>state.version>next.version ? state:next);}},()=>pipelineError.set('Your listing examples could not be opened. Try again.'));
    void readQueue(owner).then(intents=>{if(current===epoch){pipelineIntents.set(intents);void flush();}}).catch(()=>pipelineError.set('Device storage is unavailable. Your unsynced work could not be opened.'));
  });
  const stopPhotos=photoJobs.subscribe(()=>void flush());
  const online=()=>{connection.set(navigator.onLine);void flush();};online();
  const leaving=(event:BeforeUnloadEvent)=>{if(get(pipelineSaving)>0){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',leaving);
  window.addEventListener('online',online);window.addEventListener('offline',online);
  return ()=>{channel?.close();channel=undefined;stop();stopStyle();stopPhotos();uid='';epoch++;window.removeEventListener('beforeunload',leaving);window.removeEventListener('online',online);window.removeEventListener('offline',online);};
}

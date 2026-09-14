import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { examplesSchema, copySchema, moneySchema, snapshotSchema, canonical, initialWorkflow, resolvedSnapshot, fields } from './shared/proposal.mjs';
import { FixtureListingGenerator } from './generator.mjs';
import { ensureDerivative } from './photos.mjs';
const hash = data => createHash('sha256').update(canonical(data)).digest('hex');
const id = z.string().min(1).max(256).regex(/^[a-zA-Z0-9-]+$/);
const version = z.number().int().nonnegative();
const requestSchema = z.discriminatedUnion('kind', [
  z.object({ kind:z.literal('examples'), examples:examplesSchema, previousExamples:examplesSchema, expectedVersion:version }),
  z.object({ kind:z.literal('learn'), expectedVersion:version }),
  z.object({ kind:z.literal('generate'), listingId:id, expectedVersion:version, photoIds:z.array(id).min(1).max(8), context:z.string().max(2000), styleVersion:version, replace:z.boolean() }),
  z.object({ kind:z.literal('edit'), listingId:id, expectedVersion:version, field:z.enum(fields), value:z.string().max(5000), previousValue:z.string().max(5000) }),
  z.object({ kind:z.literal('price'), listingId:id, expectedVersion:version, price:moneySchema }),
  z.object({ kind:z.literal('approve'), listingId:id, expectedVersion:version, baseVersion:version, snapshot:snapshotSchema })
]);
export class Conflict extends Error {}
export const emptyStyle = () => ({ version:0, examples:[], profile:null, status:'empty', stage:0, operationId:'', error:'' });
export class PipelineService {
  constructor(db,bucket,projectId) { this.db=db; this.bucket=bucket; this.generator=new FixtureListingGenerator(projectId); }
  account(workspace,uid) { return this.db.doc(`workspaces/${workspace}/accounts/${uid}`); }
  async submit(uid,raw) {
    const { workspace, commandId } = z.object({ workspace:z.string().regex(/^(main|pr-[1-9][0-9]*|e2e)$/), commandId:z.string().uuid() }).parse(raw);
    const request=requestSchema.parse(raw.request);
    const account=this.account(workspace,uid);
    const op=account.collection('operations').doc(commandId);
    const listing=request.listingId ? account.collection('listings').doc(request.listingId) : null;
    const target=listing ? listing.collection('pipeline').doc('state') : account.collection('style').doc('state');
    return this.db.runTransaction(async tx => {
      const [existing, current, descriptor, styleDoc, events] = await Promise.all([
        tx.get(op), tx.get(target), tx.get(listing || account),
        listing ? tx.get(account.collection('style').doc('state')) : Promise.resolve(null),
        listing ? tx.get(listing.collection('events')) : Promise.resolve(null)
      ]);
      if (existing.exists) {
        if (existing.data().requestHash !== hash(request)) throw new Conflict('This request has different content. Please review and try again.');
        return { state:current.data() || (listing ? initialWorkflow() : emptyStyle()), operation:existing.data() };
      }
      if (!descriptor.exists || descriptor.data().ownerUid !== uid) throw new Conflict('Your saved item is unavailable. Reopen it and try again.');
      let state=current.data() || (listing ? initialWorkflow() : emptyStyle());
      if (state.version !== request.expectedVersion) throw new Conflict('This item changed elsewhere. Review the latest version before continuing.');
      let input=null;
      let status='completed';
      if (request.kind==='examples') {
        if (canonical(state.examples)!==canonical(request.previousExamples)) throw new Conflict('Your examples changed elsewhere. Review the latest examples before replacing them.');
        state={...state, examples:request.examples, profile:null, status:request.examples.length ? 'needs-learning':'empty', operationId:commandId, error:''};
      } else if (request.kind==='learn') {
        if (!state.examples.length || state.examples.some(e=>!e.title.trim() || !e.description.trim())) throw new Conflict('Add a title and description to each example.');
        input={examples:state.examples, sourceVersion:state.version, fingerprint:hash(state.examples)};
        state={...state,status:'learning',stage:0,operationId:commandId,error:''}; status='queued';
      } else if (request.kind==='generate') {
        if (state.approved) throw new Conflict('This listing is approved. Start a new listing for another version.');
        if (state.status==='generating') throw new Conflict('A draft is already being created.');
        if (state.proposal && !request.replace) throw new Conflict('Confirm replacement of the current proposal first.');
        const style=styleDoc.data();
        if (style?.status!=='ready' || style.version!==request.styleVersion) throw new Conflict('Your examples changed. Learn your style again before creating a draft.');
        // Originals are immutable. Pin referenced versions from their acknowledged
        // events, including versions since removed from the editable capture set.
        const all=events.docs.map(d=>d.data());
        const photos=request.photoIds.map(photoId=>all.find(e=>['photo/uploaded','photo/replaced'].includes(e.type) && e.payload.photo.id===photoId)?.payload.photo);
        if (new Set(request.photoIds).size!==request.photoIds.length || photos.some(p=>!p)) throw new Conflict('Some photos have not synced. Return to photos and retry.');
        if (request.context && !all.some(e=>e.type==='context/changed' && e.payload.context===request.context)) throw new Conflict('Your details have not synced. Return to photos and retry.');
        const prefix=`${listing.path}/photos/`;
        if (photos.some(p=>p.path!==`${prefix}${p.id}/original`)) throw new Conflict('Photo ownership does not match this item.');
        input={ photos, context:request.context, baseVersion:descriptor.data().version, styleVersion:style.version, profile:style.profile, examples:style.examples };
        input.fingerprint=hash(input);
        state={...state,status:'generating',stage:0,operationId:commandId,input,error:''}; status='queued';
      } else {
        if (state.status!=='reviewing') throw new Conflict('Open the current review before changing or approving it.');
        if (request.kind==='edit') {
          if (state.copy[request.field]!==request.previousValue) throw new Conflict('This field changed in another tab or device. Review the latest version before replacing it.');
          state={...state,copy:copySchema.parse({...state.copy,[request.field]:request.value})};
        }
        if (request.kind==='price') state={...state,price:request.price};
        if (request.kind==='approve') {
          if (!state.copy.title.trim() || !state.copy.description.trim()) throw new Conflict('A title and description are needed before approval.');
          if (descriptor.data().version!==request.baseVersion || request.baseVersion!==state.input.baseVersion || canonical(resolvedSnapshot(state))!==canonical(request.snapshot)) throw new Conflict('The reviewed version changed. Check the latest photos and details before approving.');
          state={...state,status:'approved',approved:request.snapshot};
        }
      }
      state={...state,version:state.version+1,lastCommandId:commandId,updatedAt:new Date().toISOString()};
      const operation={ uid,workspace,request,requestHash:hash(request),input,status,stage:0,attempts:0,target:target.path,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp() };
      tx.create(op,operation);
      this.record(tx,target,state,commandId,`${request.kind}/requested`);
      return {state,operation:{status,stage:0}};
    });
  }
  record(tx,target,state,eventId,type) {
    tx.set(target,state);
    tx.create(target.parent.parent.collection('workflowEvents').doc(eventId), {id:eventId,type,schemaVersion:1,version:state.version,state,createdAt:FieldValue.serverTimestamp()});
  }
  async stage(opRef,index,mutate) {
    return this.db.runTransaction(async tx=>{
      const opDoc=await tx.get(opRef); const op=opDoc.data();
      if (!op || ['completed','failed','superseded'].includes(op.status) || op.stage>=index) return false;
      const target=this.db.doc(op.target); const doc=await tx.get(target); let state=doc.data();
      if (state.operationId!==opRef.id) {tx.update(opRef,{status:'superseded'}); return false;}
      state={...state,...mutate(state,op),stage:index,version:state.version+1,updatedAt:new Date().toISOString()};
      this.record(tx,target,state,`${opRef.id}-${index}`,`${op.request.kind}/stage-${index}`);
      tx.update(opRef,{stage:index,status:index===3 ? 'completed':'running',updatedAt:FieldValue.serverTimestamp()});
      return true;
    });
  }
  async execute(opRef) {
    let op=(await opRef.get()).data();
    if (!op || !['queued','running'].includes(op.status)) return;
    // At-least-once delivery is safe: each stage and its event commit together.
    try {
      await opRef.update({attempts:FieldValue.increment(1)});
      await this.stage(opRef,1,()=>({}));
      op=(await opRef.get()).data();
      if (op.status==='superseded') return;
      if (op.request.kind==='learn') {
        await this.stage(opRef,2,()=>({}));
        await this.stage(opRef,3,()=>({status:'ready',profile:{id:opRef.id,provider:'review-sample',sample:true,sourceVersion:op.input.sourceVersion,sourceIds:op.input.examples.map(e=>e.id),fingerprint:op.input.fingerprint,summary:'Examples saved for the sample journey. Personal style analysis is not enabled.'}}));
      } else {
        const derivatives=[];
        for (const photo of op.input.photos) derivatives.push(await ensureDerivative(this.bucket,photo));
        await this.stage(opRef,2,()=>({derivatives}));
        const proposal=this.generator.generate(op.input);
        await this.stage(opRef,3,()=>({status:'reviewing',proposal,proposalId:opRef.id,copy:proposal.copy,price:proposal.pricing.recommended,approved:null}));
      }
    } catch (error) {
      const latest=(await opRef.get()).data();
      if ((latest.attempts||0)<5) throw error;
      await this.db.runTransaction(async tx=>{
        const target=this.db.doc(latest.target); const doc=await tx.get(target); const state=doc.data();
        tx.update(opRef,{status:'failed',updatedAt:FieldValue.serverTimestamp()});
        if (state.operationId===opRef.id) this.record(tx,target,{...state,status:'failed',error:'We could not finish. Your inputs are saved; please try again.',version:state.version+1},`${opRef.id}-failed`,'operation/failed');
      });
    }
  }
}

import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { copySchema, moneySchema, snapshotSchema, canonical, initialWorkflow, resolvedSnapshot, fields } from './shared/proposal.mjs';
import { ListingGenerator } from './generator.mjs';
import { ensureDerivative } from './photos.mjs';
const hash = data => createHash('sha256').update(canonical(data)).digest('hex');
const id = z.string().min(1).max(256).regex(/^[a-zA-Z0-9-]+$/);
const version = z.number().int().nonnegative();
const requestSchema = z.discriminatedUnion('kind', [
  z.object({ kind:z.literal('generate'), listingId:id, expectedVersion:version, photoIds:z.array(id).min(1).max(8), context:z.string().max(2000), replace:z.boolean() }),
  z.object({ kind:z.literal('feedback'), listingId:id, expectedVersion:version, text:z.string().trim().min(1).max(1000), previousCopy:copySchema.pick({title:true,description:true}) }),
  z.object({ kind:z.literal('forget'), listingId:id, expectedVersion:version, instructionId:id }),
  z.object({ kind:z.literal('edit'), listingId:id, expectedVersion:version, field:z.enum(fields), value:z.string().max(5000), previousValue:z.string().max(5000) }),
  z.object({ kind:z.literal('price'), listingId:id, expectedVersion:version, price:moneySchema }),
  z.object({ kind:z.literal('approve'), listingId:id, expectedVersion:version, baseVersion:version, snapshot:snapshotSchema })
]);
export class Conflict extends Error {}
export class PipelineService {
  constructor(db,bucket,projectId, generator = new ListingGenerator(projectId)) { this.db=db; this.bucket=bucket; this.generator=generator; }
  account(workspace,uid) { return this.db.doc(`workspaces/${workspace}/accounts/${uid}`); }
  async submit(uid,raw) {
    const { workspace, commandId } = z.object({ workspace:z.string().regex(/^(main|pr-[1-9][0-9]*|e2e)$/), commandId:z.string().uuid() }).parse(raw);
    const request=requestSchema.parse(raw.request);
    const account=this.account(workspace,uid);
    const op=account.collection('operations').doc(commandId);
    const listing=account.collection('listings').doc(request.listingId);
    const target=listing.collection('pipeline').doc('state');
    const preferences=account.collection('language').doc('state');
    return this.db.runTransaction(async tx => {
      const [existing, current, descriptor, events, memory] = await Promise.all([
        tx.get(op), tx.get(target), tx.get(listing),
        tx.get(listing.collection('events')), tx.get(preferences)
      ]);
      if (existing.exists) {
        if (existing.data().requestHash !== hash(request)) throw new Conflict('This request has different content. Please review and try again.');
        return { state:current.data() || initialWorkflow(), operation:existing.data() };
      }
      if (!descriptor.exists || descriptor.data().ownerUid !== uid) throw new Conflict('Your saved item is unavailable. Reopen it and try again.');
      let state=current.data() || initialWorkflow();
      if (state.version !== request.expectedVersion) throw new Conflict('This item changed elsewhere. Review the latest version before continuing.');
      const instructions=memory.data()?.instructions || [];
      let input=null;
      let status='completed';
      if (request.kind==='generate') {
        if (state.approved && state.proposal?.schemaVersion===2) throw new Conflict('This listing is approved. Start a new listing for another version.');
        if (state.status==='generating') throw new Conflict('A draft is already being created.');
        if (state.proposal && !request.replace) throw new Conflict('Confirm replacement of the current proposal first.');
        // Originals are immutable. Pin referenced versions from their acknowledged
        // events, including versions since removed from the editable capture set.
        const all=events.docs.map(d=>d.data());
        const photos=request.photoIds.map(photoId=>all.find(e=>['photo/uploaded','photo/replaced'].includes(e.type) && e.payload.photo.id===photoId)?.payload.photo);
        if (new Set(request.photoIds).size!==request.photoIds.length || photos.some(p=>!p)) throw new Conflict('Some photos have not synced. Return to photos and retry.');
        if (request.context && !all.some(e=>e.type==='context/changed' && e.payload.context===request.context)) throw new Conflict('Your details have not synced. Return to photos and retry.');
        const prefix=`${listing.path}/photos/`;
        if (photos.some(p=>p.path!==`${prefix}${p.id}/original`)) throw new Conflict('Photo ownership does not match this item.');
        input={ photos, context:request.context, baseVersion:descriptor.data().version, instructions };
        input.fingerprint=hash(input);
        state={...state,status:'generating',stage:0,operationId:commandId,input,revision:null,price:state.proposal?.schemaVersion===2 ? state.price : null,error:''}; status='queued';
      } else {
        if (state.status!=='reviewing') throw new Conflict('Open the current review before changing or approving it.');
        if (request.kind==='feedback') {
          if(state.proposal?.schemaVersion!==2) throw new Conflict('Create a new draft from your photos before applying feedback.');
          if(state.revision?.status==='pending') throw new Conflict('A language revision is already running.');
          if(canonical(request.previousCopy)!==canonical({title:state.copy.title,description:state.copy.description})) throw new Conflict('The wording changed elsewhere. Review it before applying feedback.');
          if(instructions.length>=20 && !instructions.some(i=>i.text===request.text)) throw new Conflict('Remove an older language instruction before adding another.');
          const next=[...instructions.filter(i=>i.text!==request.text),{id:commandId,text:request.text}];
          input={copy:{title:state.copy.title,description:state.copy.description},instructions:next,proposalId:state.proposalId};
          input.fingerprint=hash(input);
          tx.set(preferences,{instructions:next,version:(memory.data()?.version || 0)+1});
          state={...state,revision:{id:commandId,status:'pending',text:request.text},error:''};status='queued';
        }
        if (request.kind==='forget') {
          tx.set(preferences,{instructions:instructions.filter(i=>i.id!==request.instructionId),version:(memory.data()?.version || 0)+1});
        }
        if (request.kind==='edit') {
          if (state.copy[request.field]!==request.previousValue) throw new Conflict('This field changed in another tab or device. Review the latest version before replacing it.');
          state={...state,copy:copySchema.parse({...state.copy,[request.field]:request.value})};
        }
        if (request.kind==='price') state={...state,price:request.price};
        if (request.kind==='approve') {
          if(state.revision?.status==='pending') throw new Conflict('Wait for the wording revision before approving.');
          if(state.proposal?.schemaVersion!==2) throw new Conflict('Create a new draft from your photos before approving.');
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
    let op;
    const claimed=await this.db.runTransaction(async tx=>{
      const doc=await tx.get(opRef);op=doc.data();
      if(!op || !['queued','running'].includes(op.status))return false;
      if(op.leaseUntil>Date.now())throw new Error('Operation is already running');
      tx.update(opRef,{attempts:FieldValue.increment(1),leaseUntil:Date.now()+150000});return true;
    });
    if(!claimed)return;
    try {
      if((op.attempts || 0)>=3)throw new Error('Provider attempt limit reached');
      if(op.request.kind==='feedback') {
        const current=(await this.db.doc(op.target).get()).data();
        if(current.revision?.id!==opRef.id || current.revision.status!=='pending'){await opRef.update({status:'superseded',leaseUntil:0});return;}
        const result=op.result || await this.generator.revise(op.input);
        if(!op.result)await opRef.update({result});
        await this.db.runTransaction(async tx=>{
          const target=this.db.doc(op.target);const doc=await tx.get(target);const state=doc.data();
          if(state.revision?.id!==opRef.id || state.revision.status!=='pending'){tx.update(opRef,{status:'superseded',leaseUntil:0});return;}
          const unchanged=state.proposalId===op.input.proposalId && canonical({title:state.copy.title,description:state.copy.description})===canonical(op.input.copy);
          const next={...state,copy:unchanged ? {...state.copy,...result.copy}:state.copy,proposal:unchanged ? {...state.proposal,copy:{...state.proposal.copy,...result.copy},model:result.model,inputFingerprint:op.input.fingerprint}:state.proposal,proposalId:unchanged ? opRef.id:state.proposalId,revision:{id:opRef.id,status:unchanged?'applied':'conflict',text:op.request.text,model:result.model,inputFingerprint:op.input.fingerprint},version:state.version+1,updatedAt:new Date().toISOString()};
          this.record(tx,target,next,`${opRef.id}-result`,'feedback/completed');
          tx.update(opRef,{status:'completed',leaseUntil:0});
        });
        return;
      }
      const derivatives=[];
      for (const photo of op.input.photos) derivatives.push(await ensureDerivative(this.bucket,photo));
      await this.stage(opRef,1,()=>({derivatives}));
      const latest=(await opRef.get()).data();
      if(['completed','superseded'].includes(latest.status))return;
      const images=await Promise.all(derivatives.map(async d=>(await this.bucket.file(d.path).download())[0]));
      const proposal=op.result || await this.generator.generate(op.input,images);
      if(!op.result)await opRef.update({result:proposal});
      // The validated model result is now durable; only saving the review remains.
      await this.stage(opRef,2,()=>({}));
      await this.stage(opRef,3,state=>({status:'reviewing',proposal,proposalId:opRef.id,copy:proposal.copy,price:state.price || null,approved:null}));
      await opRef.update({leaseUntil:0});
    } catch (error) {
      const latest=(await opRef.get()).data();
      if(['completed','superseded'].includes(latest.status))return;
      await opRef.update({leaseUntil:0});
      if ((latest.attempts||0)<3) throw error;
      await this.db.runTransaction(async tx=>{
        const target=this.db.doc(latest.target); const doc=await tx.get(target); const state=doc.data();
        tx.update(opRef,{status:'failed',updatedAt:FieldValue.serverTimestamp()});
        if(latest.request.kind==='feedback') {
          if(state.revision?.id===opRef.id && state.revision.status==='pending')this.record(tx,target,{...state,revision:{...state.revision,status:'failed'},version:state.version+1},`${opRef.id}-failed`,'feedback/failed');
        } else if (state.operationId===opRef.id) this.record(tx,target,{...state,status:'failed',error:'We could not finish. Your inputs are saved; please try again.',version:state.version+1},`${opRef.id}-failed`,'operation/failed');
      });
    }
  }
}

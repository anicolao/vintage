import { defineSecret } from 'firebase-functions/params';
import { handler as deletionHandler, publicKeyLoader, recordDeletion } from './ebay-deletion.mjs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { PipelineService, Conflict } from './service.mjs';
import { ensureDerivative } from './photos.mjs';
const app=initializeApp();
const db=getFirestore();
const projectId=app.options.projectId || process.env.GCLOUD_PROJECT;
const bucketName=projectId==='demo-vintage' ? 'demo-vintage.appspot.com' : 'vintage-review-anicolao.firebasestorage.app';
const bucket=getStorage().bucket(bucketName);
const soldgraphKey=defineSecret('SOLDGRAPH_API_KEY');
const service=new PipelineService(db,bucket,projectId);
if(projectId!=='demo-vintage')service.market.key=()=>soldgraphKey.value();
const region='europe-west1';
if (projectId!=='demo-vintage') setGlobalOptions({serviceAccount:'vintage-pipeline-runtime@vintage-review-anicolao.iam.gserviceaccount.com'});
export const submitCommand=onCall({region,maxInstances:10,timeoutSeconds:60},async request=>{
  if (!request.auth) throw new HttpsError('unauthenticated','Sign in again to continue.');
  try {return await service.submit(request.auth.uid,request.data);}
  catch(error) {
    if (error instanceof Conflict) throw new HttpsError('failed-precondition',error.message);
    if (error.name==='ZodError') throw new HttpsError('invalid-argument','Check the supplied fields and try again.');
    throw new HttpsError('internal','This change could not sync. Please try again.');
  }
});
export const executeCommand=onDocumentCreated({document:'workspaces/{workspace}/accounts/{uid}/operations/{commandId}',region,retry:true,memory:'1GiB',timeoutSeconds:540,maxInstances:5,secrets:projectId==='demo-vintage'?[]:[soldgraphKey]},event=>service.execute(event.data.ref));
export const normalizeOriginal=onObjectFinalized({bucket:bucketName,region,retry:true,memory:'1GiB',timeoutSeconds:120,maxInstances:5},async event=>{
  const file=event.data;
  if (event.time && Date.now()-Date.parse(event.time)>86400000) return;
  if (!/^workspaces\/(main|pr-[1-9][0-9]*|e2e)\/accounts\/[^/]+\/listings\/[^/]+\/photos\/[^/]+\/original$/.test(file.name)) return;
  try {await ensureDerivative(bucket,{path:file.name,digest:file.metadata?.digest,type:file.contentType});}
  catch(error) {
    // Invalid media remains available for replacement. Transport failures retry.
    if (/fingerprint|unsupported|decode|Invalid|dimensions|Input buffer|HEIF/i.test(error.message)) return;
    throw error;
  }
});
// Bounded, conservative cleanup: retain every original referenced in any event,
// including removed photos (Undo) and pinned generation/approval inputs. Never
// remove a recent object: interrupted clients have 30 days to finish recording it.
export const cleanOrphanPhotos=onSchedule({schedule:'every 24 hours',region,timeoutSeconds:300,memory:'512MiB',maxInstances:1},async()=>{
  const cursor=db.doc('_operations/photo-cleanup'); const previous=(await cursor.get()).data();
  const [files,,response]=await bucket.getFiles({prefix:'workspaces/',maxResults:200,autoPaginate:false,pageToken:previous?.pageToken || undefined});
  for (const file of files) {
    const match=file.name.match(/^(workspaces\/[^/]+\/accounts\/[^/]+\/listings\/[^/]+)\/photos\/([^/]+)\/(original|preview|analysis-v1)$/);
    if (!match || Date.now()-Date.parse(file.metadata.timeCreated)<30*86400000) continue;
    const events=await db.collection(`${match[1]}/events`).get();
    if (events.docs.some(d=>d.data().payload?.photo?.id===match[2])) continue;
    await file.delete({ignoreNotFound:true,ifGenerationMatch:file.metadata.generation});
  }
  await cursor.set({pageToken:response?.nextPageToken || '',updatedAt:new Date()});
});

const ebayVerificationToken=defineSecret('EBAY_DELETION_VERIFICATION_TOKEN');
const ebayCredentials=defineSecret('EBAY_NOTIFICATION_CREDENTIALS');
const deletionState=db.doc('_operations/ebay-deletions');
const getEbayKey=publicKeyLoader(()=>JSON.parse(ebayCredentials.value()));
export const ebayAccountDeletion=onRequest({region,invoker:'public',maxInstances:2,timeoutSeconds:60,secrets:[ebayVerificationToken,ebayCredentials]},deletionHandler({
  token:()=>ebayVerificationToken.value(),getKey:getEbayKey,
  revision:async()=> (await deletionState.get()).data()?.revision || 0,
  record:notificationHash=>recordDeletion(deletionState,notificationHash)
}));

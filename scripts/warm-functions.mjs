// Emulator startup check. Exercise the actual queued worker before the browser
// action budget begins; test data and the AI HTTP double stay local.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PipelineService} from '../functions/service.mjs';
import {digest} from '../functions/photos.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8280' || process.env.FIREBASE_STORAGE_EMULATOR_HOST!=='127.0.0.1:9290' || process.env.VINTAGE_AI_TEST_ENDPOINT!=='http://127.0.0.1:9399')throw new Error('Worker warmup requires local emulators and the test AI server');
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const result=await fetch('http://127.0.0.1:5001/demo-vintage/europe-west1/submitCommand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{}})});
if(result.status!==401)throw new Error('Callable authentication boundary did not reject anonymous startup request');
const app=initializeApp({projectId:'demo-vintage',storageBucket:'demo-vintage.appspot.com'},'worker-startup');
const db=getFirestore(app);const bucket=getStorage(app).bucket();const service=new PipelineService(db,bucket,'demo-vintage');
const uid=`startup-${randomUUID()}`;const account=service.account('e2e',uid);const listing=account.collection('listings').doc(randomUUID());
const photo={id:randomUUID(),path:'',previewPath:'',type:'image/png',size:0,width:1,height:1,digest:''};
photo.path=`${listing.path}/photos/${photo.id}/original`;photo.previewPath=photo.path;
const bytes=readFileSync(new URL('../static/images/wardrobe.png',import.meta.url));photo.size=bytes.length;photo.digest=digest(bytes);
const dimensions=await require('sharp')(bytes).metadata();photo.width=dimensions.width;photo.height=dimensions.height;
try {
  await account.set({ownerUid:uid});await listing.set({ownerUid:uid,version:1});
  await bucket.file(photo.path).save(bytes,{resumable:false,contentType:'image/png',metadata:{metadata:{digest:photo.digest}}});
  await listing.collection('events').doc('photo').set({type:'photo/uploaded',payload:{photo}});
  const commandId=randomUUID();
  await service.submit(uid,{workspace:'e2e',commandId,request:{kind:'generate',listingId:listing.id,expectedVersion:0,photoIds:[photo.id],context:'',replace:false}});
  await new Promise((resolve,reject)=>{
    let stop=()=>{};
    const timer=setTimeout(()=>{stop();reject(new Error('Queued Functions worker did not become ready'));},30000);
    stop=account.collection('operations').doc(commandId).onSnapshot(snapshot=>{
      const status=snapshot.data()?.status;
      if(status==='completed' || status==='failed'){clearTimeout(timer);stop();status==='completed'?resolve():reject(new Error('Queued worker startup failed'));}
    },error=>{clearTimeout(timer);stop();reject(error);});
  });
  console.log('Callable authentication and actual generation worker are ready.');
} finally {
  await db.recursiveDelete(account);
  await bucket.deleteFiles({prefix:`${listing.path}/photos/`});
  await db.terminate();await deleteApp(app);
}

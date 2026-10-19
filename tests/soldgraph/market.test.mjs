import {readFileSync} from 'node:fs';
const photo=readFileSync('static/images/wardrobe.png');
const imageTransport=async()=>new Response(photo);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, MarketResearch } from '../../functions/market.mjs';
const rows=[20,25,30].map((amount,i)=>({evidenceId:String(i),imageUrl:'https://i.ebayimg.com/images/g/test/s-l500.jpg',sourceUrl:`https://www.ebay.co.uk/itm/${i}`,displayedPrice:{amount:String(amount),currency:'GBP'},excludedReason:null}));
const report={results:rows,query:'coat',requestId:'job',window:{from:'2026-09-01',to:'2026-10-01'}};
const decision={anchorId:'1',priceId:'1',anchorReason:'Same item type and condition.',priceReason:'No evidence supports an adjustment.'};
const selection={matches:rows.map(r=>({evidenceId:r.evidenceId,reason:'Same type and condition.'})),caution:'Check differences.'};
test('recommendation derives only from selected eligible evidence; rejects invented and duplicate IDs',()=>{
 const r=recommend(report,selection,decision);assert.equal(r.status,'ready');assert.equal(r.suggestedPrice.minor,2500);assert.deepEqual(r.comparableRange,{low:2000,high:3000});
 assert.equal(recommend(report,{...selection,matches:selection.matches.slice(0,2)}).status,'insufficient');
 for(const matches of [[...selection.matches,{evidenceId:'invented',reason:'x'}],[selection.matches[0],selection.matches[0]]]) assert.throws(()=>recommend(report,{...selection,matches}));
 assert.throws(()=>recommend({...report,results:rows.map(r=>({...r,excludedReason:'offer'}))},selection));
});
test('durable completed search is reused for model retry without another credit',async()=>{
 let calls=0;
 const generator={request:async(system,parts)=>{calls++;if(JSON.parse(parts[0].text).candidates)return {result:decision,model:{model:'test'}};return {result:{assessments:rows.map(r=>({evidenceId:r.evidenceId,failedCriteria:[],unsafe:false,visualScore:5,visualReason:'Same visible design.'}))},model:{provider:'vertex-ai',model:'test',promptVersion:'2'}};}};
 const market=new MarketResearch(generator,{imageTransport,key:()=>{throw new Error('Should not request a key');}});
 const r=await market.research({copy:{title:'coat'}},'operation',{query:'coat',report:{...report,status:'complete'}},async()=>{},[photo]);
 assert.equal(calls,2);assert.equal(r.status,'ready');
});

test('fresh research keeps all 200 candidates for selection, persists query provenance, and respects selected evidence',async()=>{
 let requests=0;const checkpoints=[];
 const data=Array.from({length:200},(_,i)=>({id:String(i),image:'https://i.ebayimg.com/images/g/test/s-l500.jpg',title:'Gucci heels',link:`https://www.ebay.co.uk/itm/${i}`,sold_date:new Date().toISOString().slice(0,10),displayed_price:{amount:20+i,currency:'GBP'},best_offer_accepted:false}));
 const generator={request:async(system,parts)=>{
  const input=JSON.parse(parts[0].text);
  if(input.candidates)return {result:{...decision,anchorId:'198',priceId:'198'},model:{model:'test'}};
  if(!input.evidence)return {result:{query:'Gucci heels',condition:'used'},model:{provider:'vertex-ai',model:'test'}};
  assert.ok(input.evidence.length<=8);
  return {result:{assessments:input.evidence.map(r=>({evidenceId:r.evidenceId,failedCriteria:Number(r.evidenceId)<197?['category']:[],unsafe:false,visualScore:5,visualReason:'Same visible design.'}))},model:{model:'test'}};
 }};
 const market=new MarketResearch(generator,{imageTransport,key:()=> 'test-secret',transport:async url=>{
  requests++;const u=new URL(url);assert.equal(u.searchParams.get('q'),'Gucci heels');assert.equal(u.searchParams.get('count'),'200');assert.equal(u.searchParams.get('condition'),'used');
  return new Response(JSON.stringify({status:'complete',request_id:'job-200',result:{provider:'ebay',country:'uk',query:'Gucci heels',page:1,schema_version:2,data,next_page:2}}));
 }});
 const result=await market.research({copy:{title:'Vintage Gucci Snakeskin Pumps'}},'operation',{},async v=>checkpoints.push(structuredClone(v)),[photo]);
 assert.equal(requests,1);assert.equal(result.fetchedCount,200);assert.equal(result.condition,'used');assert.equal(result.matches.length,3);assert.equal(result.suggestedPrice.minor,21800);
 assert.equal(checkpoints[0].queryModel.promptVersion,'brand-category-condition-v1');
});

test('unknown condition is unfiltered and retries preserve the original condition without regenerating a query',async()=>{
 for(const saved of [{},{query:'Gucci heels',condition:'used',requestId:'resume-job'}]) {
  let generations=0;
  const market=new MarketResearch({request:async()=>{generations++;return {result:{query:'Gucci heels',condition:'unknown'},model:{model:'test'}};}},{key:()=> 'test-secret',transport:async url=>{
   const u=new URL(url);
   if(saved.requestId)assert.equal(u.pathname,'/v1/jobs/resume-job');
   else assert.equal(u.searchParams.has('condition'),false);
   return new Response(JSON.stringify({status:'complete',request_id:saved.requestId||'fresh-job',result:{provider:'ebay',country:'uk',query:'Gucci heels',page:1,schema_version:2,data:[]}}));
  }});
  const result=await market.research({copy:{title:'Vintage Gucci heels',condition:''}},'operation',saved);
  assert.equal(generations,saved.query?0:1);assert.equal(result.condition,saved.condition||null);
 }
});

test('relaxing material reuses evidence and assessments and only requests a new anchor decision',async()=>{
 const criteria=[{id:'category',value:'heels'},{id:'material',value:'Python print'}];
 const assessments=rows.map(r=>({evidenceId:r.evidenceId,failedCriteria:['material'],unsafe:false,visualScore:5,visualReason:'Same visible design.'}));
 let calls=0;const market=new MarketResearch({request:async(system,parts)=>{calls++;assert.ok(JSON.parse(parts[0].text).candidates);return {result:decision,model:{model:'test'}};}},{imageTransport,key:()=>assert.fail('Must not buy another search')});
 const {loadMarketImage}=await import('../../functions/market-images.mjs');const image=await loadMarketImage(rows[0].imageUrl,imageTransport);
 const saved={query:'Gucci heels',report:{...report,status:'complete'},criteria,assessments,assessmentModel:{promptVersion:'photo-comparison-v1'},photoEvidence:Object.fromEntries(rows.map(r=>[r.evidenceId,{digest:image.digest,url:r.imageUrl}]))};
 const strict=await market.research({copy:{}},'strict',saved,async()=>{},[photo]);
 assert.equal(strict.status,'insufficient');assert.equal(strict.criteria.find(c=>c.id==='material').excludedCount,3);
 assert.equal(strict.criteria.find(c=>c.id==='material').restoredCount,3);
 let checkpoint;const relaxed=await market.research({copy:{},enabledCriteria:['category']},'relaxed',saved,async v=>{checkpoint=v;},[photo]);
 assert.equal(relaxed.status,'ready');assert.equal(relaxed.matchingCount,3);assert.match(relaxed.caution,/Python print/);assert.equal(calls,1);
 await market.research({copy:{},enabledCriteria:['category']},'retry',checkpoint,async()=>{},[photo]);assert.equal(calls,1);
});

test('both photo sets reach visual assessment and anchor selection; old text decisions are discarded',async()=>{
 let stages=[];
 const market=new MarketResearch({request:async(system,parts)=>{
  const input=JSON.parse(parts[0].text);stages.push(input.candidates?'anchor':'assessment');
  assert.equal(parts.filter(p=>p.inlineData).length,4);
  assert.ok(parts.some(p=>p.text==='SELLER PHOTO 1'));
  for(const row of rows)assert.ok(parts.some(p=>p.text===`COMPARABLE PHOTO evidenceId=${row.evidenceId}`));
  return {result:input.candidates?decision:{assessments:rows.map(r=>({evidenceId:r.evidenceId,failedCriteria:[],unsafe:false,visualScore:4,visualReason:'Visible shape matches; wear is uncertain.'}))},model:{model:'test'}};
 }},{imageTransport,key:()=>assert.fail('No new search')});
 const saved={query:'coat',report:{...report,status:'complete'},assessmentModel:{promptVersion:'criterion-assessment-v1'},assessments:[{evidenceId:'fake'}],pricing:{criteriaKey:'["category"]',model:{promptVersion:'closest-comparable-v1'},decision:{anchorId:'fake'}}};
 const result=await market.research({copy:{title:'coat'}},'photos',saved,async()=>{},[photo]);
 assert.deepEqual(stages,['assessment','anchor']);assert.equal(result.status,'ready');assert.equal(result.visualComparisonVersion,'photo-comparison-v1');
});
test('missing images and visually different shoes cannot yield a text-only recommendation',async()=>{
 for(const scenario of ['no-seller','no-comparable','burgundy-patent','abstain','invented-anchor']){
  let calls=0;
  const market=new MarketResearch({request:async(system,parts)=>{
   calls++;const input=JSON.parse(parts[0].text);
   if(input.candidates)return {result:scenario==='abstain'?{...decision,anchorId:'',priceId:''}:{...decision,anchorId:'unseen'},model:{model:'test'}};
   return {result:{assessments:rows.map(r=>({evidenceId:r.evidenceId,failedCriteria:[],unsafe:false,visualScore:scenario==='burgundy-patent'?1:5,visualReason:'Burgundy glossy patent, different silhouette from seller black matte shoe.'}))},model:{model:'test'}};
  }},{imageTransport:scenario==='no-comparable'?async()=>new Response('',{status:404}):imageTransport});
  const run=()=>market.research({copy:{title:'black leather shoe'}},scenario,{query:'shoe',report:{...report,status:'complete'}},async()=>{},scenario==='no-seller'?[]:[photo]);
  if(scenario==='invented-anchor'){await assert.rejects(run,/photo-verified/);continue;}
  const result=await run();assert.equal(result.status,'insufficient');assert.equal(result.suggestedPrice,null);
  if(scenario.startsWith('no-'))assert.equal(calls,0);
 }
});

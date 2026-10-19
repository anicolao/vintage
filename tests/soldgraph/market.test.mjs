import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, MarketResearch } from '../../functions/market.mjs';
const rows=[20,25,30].map((amount,i)=>({evidenceId:String(i),sourceUrl:`https://www.ebay.co.uk/itm/${i}`,displayedPrice:{amount:String(amount),currency:'GBP'},excludedReason:null}));
const report={results:rows,query:'coat',requestId:'job',window:{from:'2026-09-01',to:'2026-10-01'}};
const selection={matches:rows.map(r=>({evidenceId:r.evidenceId,reason:'Same type and condition.'})),caution:'Check differences.'};
test('recommendation derives only from selected eligible evidence; rejects invented and duplicate IDs',()=>{
 const r=recommend(report,selection);assert.equal(r.status,'ready');assert.equal(r.suggestedPrice.minor,2500);assert.deepEqual(r.comparableRange,{low:2000,high:3000});
 assert.equal(recommend(report,{...selection,matches:selection.matches.slice(0,2)}).status,'insufficient');
 for(const matches of [[...selection.matches,{evidenceId:'invented',reason:'x'}],[selection.matches[0],selection.matches[0]]]) assert.throws(()=>recommend(report,{...selection,matches}));
 assert.throws(()=>recommend({...report,results:rows.map(r=>({...r,excludedReason:'offer'}))},selection));
});
test('durable completed search is reused for model retry without another credit',async()=>{
 let calls=0;
 const generator={request:async()=>{calls++;return {result:{assessments:rows.map(r=>({evidenceId:r.evidenceId,failedCriteria:[],unsafe:false}))},model:{provider:'vertex-ai',model:'test',promptVersion:'2'}};}};
 const market=new MarketResearch(generator,{key:()=>{throw new Error('Should not request a key');}});
 const r=await market.research({copy:{title:'coat'}},'operation',{query:'coat',report:{...report,status:'complete'}});
 assert.equal(calls,1);assert.equal(r.status,'ready');
});

test('fresh research keeps all 200 candidates for selection, persists query provenance, and respects selected evidence',async()=>{
 let requests=0;const checkpoints=[];
 const data=Array.from({length:200},(_,i)=>({id:String(i),title:'Gucci heels',link:`https://www.ebay.co.uk/itm/${i}`,sold_date:new Date().toISOString().slice(0,10),displayed_price:{amount:20+i,currency:'GBP'},best_offer_accepted:false}));
 const generator={request:async(system,parts)=>{
  const input=JSON.parse(parts[0].text);
  if(!input.evidence)return {result:{query:'Gucci heels',condition:'used'},model:{provider:'vertex-ai',model:'test'}};
  assert.ok(input.evidence.length<=20);
  return {result:{assessments:input.evidence.map(r=>({evidenceId:r.evidenceId,failedCriteria:Number(r.evidenceId)<197?['category']:[],unsafe:false}))},model:{model:'test'}};
 }};
 const market=new MarketResearch(generator,{key:()=> 'test-secret',transport:async url=>{
  requests++;const u=new URL(url);assert.equal(u.searchParams.get('q'),'Gucci heels');assert.equal(u.searchParams.get('count'),'200');assert.equal(u.searchParams.get('condition'),'used');
  return new Response(JSON.stringify({status:'complete',request_id:'job-200',result:{provider:'ebay',country:'uk',query:'Gucci heels',page:1,schema_version:2,data,next_page:2}}));
 }});
 const result=await market.research({copy:{title:'Vintage Gucci Snakeskin Pumps'}},'operation',{},async v=>checkpoints.push(structuredClone(v)));
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

test('relaxing material reuses evidence and assessments with no AI or provider call',async()=>{
 const criteria=[{id:'category',value:'heels'},{id:'material',value:'Python print'}];
 const assessments=rows.map(r=>({evidenceId:r.evidenceId,failedCriteria:['material'],unsafe:false}));
 const market=new MarketResearch({request:async()=>assert.fail('Must reuse assessment')},{key:()=>assert.fail('Must not buy another search')});
 const saved={query:'Gucci heels',report:{...report,status:'complete'},criteria,assessments};
 const strict=await market.research({copy:{}},'strict',saved);
 assert.equal(strict.status,'insufficient');assert.equal(strict.criteria.find(c=>c.id==='material').excludedCount,3);
 assert.equal(strict.criteria.find(c=>c.id==='material').restoredCount,3);
 const relaxed=await market.research({copy:{},enabledCriteria:['category']},'relaxed',saved);
 assert.equal(relaxed.status,'ready');assert.equal(relaxed.matchingCount,3);assert.match(relaxed.caution,/Python print/);
});

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
 const generator={request:async()=>{calls++;return {result:selection,model:{provider:'vertex-ai',model:'test',promptVersion:'2'}};}};
 const market=new MarketResearch(generator,{key:()=>{throw new Error('Should not request a key');}});
 const r=await market.research({copy:{title:'coat'}},'operation',{query:'coat',report:{...report,status:'complete'}});
 assert.equal(calls,1);assert.equal(r.status,'ready');
});

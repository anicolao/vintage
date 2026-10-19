import {test} from 'node:test';
import assert from 'node:assert/strict';
import {anchorOptions,anchorRecommendation} from '../../functions/anchor-pricing.mjs';
const rows=[10000,11000,12000,50000].map((minor,i)=>({evidenceId:String(i),title:`Item ${i}`,sourceUrl:`https://example.com/${i}`,price:{currency:'GBP',minor}}));
const pick=(anchorId,priceId)=>({anchorId,priceId,anchorReason:'Closest in item type and condition.',priceReason:'Observed wear supports this neighboring lower price.'});
test('price follows the chosen anchor and nearest observed price, not the median',()=>{
 const result=anchorRecommendation(rows,pick('1','0'));
 assert.equal(result.suggestedPrice.minor,10000);assert.equal(result.pricing.direction,'below');assert.equal(result.pricing.adjustmentMinor,-1000);
 assert.deepEqual(result.pricing.distribution,{count:4,below:0,equal:1,above:3});
 assert.equal(anchorRecommendation(rows,pick('1','2')).pricing.direction,'above');
 assert.equal(anchorRecommendation(rows,pick('3','3')).pricing.direction,'same');
});
test('rejects invented anchors, distant/nonadjacent prices, missing reasons and keeps equal prices stable',()=>{
 for(const p of [pick('fake','0'),pick('1','3'),pick('0','2'),{...pick('1','1'),priceReason:''}])assert.throws(()=>anchorRecommendation(rows,p));
 assert.deepEqual(anchorOptions(rows).find(o=>o.anchorId==='3').allowedPriceIds,['3']);
 const duplicate={...rows[1],evidenceId:'duplicate'};
 assert.equal(anchorRecommendation([...rows,duplicate],pick('1','1')).pricing.distribution.equal,2);
});

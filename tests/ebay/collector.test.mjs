import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, options, statistics, normalize } from '../../scripts/investigate-ebay.mjs';
const config = { environment:'sandbox', queries:['jacket','coat'], marketplace:'EBAY_GB', days:30, limit:50 };
const now = new Date('2026-10-05T12:00:00Z');
const credentials = { EBAY_APP_ID:'test-client-secret', EBAY_CERT_ID:'test-cert-secret' };
const json = (data,status=200) => new Response(JSON.stringify(data), {status});
const item = (id, price='10.00', extra={}) => ({itemId:id,title:'Jacket',lastSoldDate:'2026-10-01T12:00:00Z',lastSoldPrice:{value:price,currency:'GBP'},...extra});
function transport(responses, calls=[]) {
 return async(url,init)=>{calls.push({url,init});assert.ok(responses.length,'Unexpected request');return responses.shift()();};
}
const tokens = () => [()=>json({access_token:'test-basic-token'}),()=>json({access_token:'test-sold-token'})];
test('requires environment and bounded query arguments; removes manual ID flow',()=>{
 assert.throws(()=>options(['--query','coat']));
 assert.throws(()=>options(['--environment','sandbox','12345']));
 assert.throws(()=>options(['--environment','sandbox','--query','coat','--days','91']));
 assert.equal(options(['--environment','sandbox','--query','coat']).limit,50);
});
test('scope denial is a recorded access failure, not empty results, with redacted errors',async()=>{
 const report=await collect(config,credentials,{now,transport:transport([
  ()=>json({access_token:'test-basic-token'}),
  ()=>json({error:'invalid_scope',errors:[{message:'test-cert-secret test-basic-token'}]},400)
 ])});
 assert.equal(report.authentication,'passed');assert.equal(report.soldScope,'failed');assert.equal(report.status,'access_blocked');
 assert.ok(!JSON.stringify(report).includes('test-cert-secret'));assert.ok(!JSON.stringify(report).includes('test-basic-token'));
 assert.equal(report.requests.length,2);
});
test('collects both formats, paginates, deduplicates across queries and fixes the date window',async()=>{
 const calls=[];
 const report=await collect(config,credentials,{now,transport:transport([...tokens(),
  ()=>json({itemSales:[item('a','12.00',{buyingOptions:['FIXED_PRICE']})],next:'https://api.sandbox.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?offset=1'}),
  ()=>json({itemSales:[item('b','20.00',{buyingOptions:['AUCTION']})]}),
  ()=>json({itemSales:[item('a'),item('c','30.00')]})
 ],calls)});
 assert.equal(report.status,'complete');assert.equal(report.synthetic,true);assert.equal(report.results.length,3);
 assert.deepEqual(report.results.find(r=>r.evidenceId==='a').queries,['jacket','coat']);
 assert.equal(report.queries[0].pages,2);
 for(const call of calls) assert.equal(new URL(call.url).origin,'https://api.sandbox.ebay.com');
 const first=new URL(calls[2].url);assert.equal(first.searchParams.get('filter'),'lastSoldDate:[2026-09-05T12:00:00.000Z..2026-10-05T12:00:00.000Z]');
 assert.equal(first.searchParams.has('buyingOptions'),false);
});
test('distinguishes empty success, malformed responses and denied access',async()=>{
 for(const [response,status] of [[()=>json({total:0}),'complete'],[()=>json({}),'partial_or_failed'],[()=>json({errors:[{errorId:1100,message:'Access denied'}]},403),'partial_or_failed']]){
  const report=await collect({...config,queries:['x']},credentials,{now,transport:transport([...tokens(),response])});
  assert.equal(report.status,status);assert.deepEqual(report.results,[]);
 }
});
test('does not send credentials to an untrusted pagination URL; keeps prior rows',async()=>{
 const calls=[];
 const report=await collect({...config,queries:['x']},credentials,{now,transport:transport([...tokens(),()=>json({itemSales:[item('a')],next:'https://attacker.invalid/steal'})],calls)});
 assert.equal(report.queries[0].error,'invalid_pagination');assert.equal(report.results.length,1);assert.equal(calls.length,3);
});
test('caps results and reports truncation',async()=>{
 const report=await collect({...config,queries:['x'],limit:1},credentials,{now,transport:transport([...tokens(),()=>json({itemSales:[item('a'),item('b')]})])});
 assert.equal(report.results.length,1);assert.equal(report.queries[0].status,'truncated');
});
test('price summaries use decimal arithmetic and exclude missing or out-of-window amounts',()=>{
 const window={from:'2026-09-01T00:00:00Z',to:now.toISOString()};
 const rows=['0.10','0.20','0.30','0.40'].map((p,i)=>normalize(item(String(i),p),'x',window));
 rows.push(normalize(item('missing','1',{lastSoldPrice:null}),'x',window));
 rows.push(normalize(item('old','100',{lastSoldDate:'2020-01-01T00:00:00Z'}),'x',window));
 assert.deepEqual(statistics(rows),[{currency:'GBP',count:4,basis:'listing_summary_last_sold_prices',min:'0.1',median:'0.25',max:'0.4'}]);
});

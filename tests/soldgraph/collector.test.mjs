import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, normalize, statistics, options } from '../../scripts/investigate-soldgraph.mjs';
const config = options(['--query','iphone 13']);
const now = new Date('2026-10-05T12:00:00Z');
const row = (id,amount,extra={}) => ({ id, title:'Phone', displayed_price:{amount,currency:'GBP'}, best_offer_accepted:false, sold_date:'2026-10-01', ...extra });
const complete = (rows=[],extra={}) => ({ request_id:'job-1',status:'complete',credits:1,result:{provider:'ebay',country:'uk',query:'iphone 13',page:1,schema_version:2,data:rows,next_page:2,...extra} });
const response = (data,status=200) => new Response(JSON.stringify(data),{status});
const run = (data) => collect(config,'test-secret',{now,transport:async()=>response(data)});
test('polls safely, collects all formats, deduplicates and stops at one page',async()=>{
 const calls=[];
 const report=await collect(config,'test-secret',{now,pause:async()=>{},transport:async(url,init)=>{
  calls.push({url,init});
  return calls.length===1 ? response({request_id:'job-1',status:'pending',poll_url:'/v1/jobs/job-1'},202)
   : response(complete([row('a',10,{format:'auction'}),row('b',20,{format:'fixed_price'}),row('a',10)]));
 }});
 assert.equal(report.status,'complete'); assert.equal(report.results.length,2); assert.equal(report.duplicateCount,1);
 assert.equal(calls.length,2); const u=new URL(calls[0].url);
 assert.equal(u.searchParams.get('sort'),'recently_sold'); assert.equal(u.searchParams.has('buying_format'),false);
 assert.equal(calls[1].url,'https://api.soldgraph.com/v1/jobs/job-1?wait=20');
 assert.ok(calls[0].init.headers['Idempotency-Key']); assert.equal(report.nextPage,2);
});
test('excludes hidden offers, unknowns, invalid dates and prices; exact currency statistics',()=>{
 const window={from:'2026-09-06',to:'2026-10-05'};
 const rows=[row('a',10.01),row('b',10.02),row('c',10.03),row('d',10.04),
 row('e',999,{best_offer_accepted:true}),row('f',999,{best_offer_accepted:null}),
 row('g',999,{sold_date:'2026-02-30'}),row('h',999,{sold_date:'2025-10-01'}),row('i',null),
 row('j',20,{displayed_price:{amount:20,currency:'USD'}})].map(r=>normalize(r,window));
 assert.equal(rows.filter(r=>r.excludedReason).length,5);
 const groups=statistics(rows); assert.equal(groups[0].median,'10.025');assert.equal(groups[0].count,4);
 assert.equal(groups[1].status,'insufficient_evidence');
});
test('empty completion is distinct from malformed data and failed jobs',async()=>{
 assert.equal((await run(complete())).status,'complete');
 assert.equal((await run(complete([], {data:null}))).error,'unrecognized_search_response');
 assert.equal((await run({status:'failed',request_id:'job-1',error:{code:'source_unavailable'}})).error,'provider_job_failed');
});
test('does not send credentials to a supplied foreign polling URL',async()=>{
 let calls=0;
 const result=await collect(config,'test-secret',{now,transport:async()=>{calls++;return response({status:'pending',request_id:'job-1',poll_url:'https://evil.example/v1/jobs/job-1'});}});
 assert.equal(calls,1);assert.equal(result.error,'unsafe_poll_url');
});
test('HTTP errors and transport failures never become empty success or automatic paid retries',async()=>{
 for (const [status,error] of [[401,'invalid_credentials'],[429,'rate_or_quota_limit'],[503,'http_503']]) {
  let calls=0; const r=await collect(config,'test-secret',{now,transport:async()=>{calls++;return response({},status);}});
  assert.equal(r.error,error); assert.equal(calls,1);
 }
 const r=await collect(config,'test-secret',{now,transport:async()=>{throw new Error('test-secret');}});
 assert.equal(r.error,'transport_failure');assert.ok(!JSON.stringify(r).includes('test-secret'));
});
test('resume uses only job endpoint; rejects mismatched results and redacts persisted evidence',async()=>{
 const snapshots=[];let url;
 const r=await collect({...config,requestId:'job-1'},'test-secret',{now,checkpoint:async r=>snapshots.push(r),transport:async u=>{url=u;return response(complete([row('a',20,{title:'test-secret'})]));}});
 assert.ok(url.includes('/v1/jobs/'));assert.equal(r.status,'complete');assert.ok(!JSON.stringify(snapshots).includes('test-secret'));
 assert.equal((await run(complete([],{query:'another query'}))).status,'failed');
});
test('polling is bounded and keeps the request ID for resume',async()=>{
 let calls=0;
 const r=await collect(config,'test-secret',{now,pause:async()=>{},transport:async()=>{calls++;return response({request_id:'job-1',status:'pending'});}});
 assert.equal(calls,16); assert.equal(r.requestId,'job-1');assert.equal(r.error,'polling_limit_resume_with_request_id');
});
test('invalid CLI arguments fail before any request',()=>{
 for (const args of [[],['--query','x','--days','0'],['--query','x','--country','zz'],['--query','x','--request-id','../oops']]) assert.throws(()=>options(args));
});

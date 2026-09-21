import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { ListingGenerator } from '../../functions/generator.mjs';
import { normalizePhoto } from '../../functions/photos.mjs';
import { proposalSchema, moneySchema, snapshotSchema, reduceWorkflow, initialWorkflow } from '../../functions/shared/proposal.mjs';
test('sample contracts are rejected and test transport cannot be enabled in live projects',()=>{
  const previous=process.env.VINTAGE_AI_TEST_ENDPOINT;
  process.env.VINTAGE_AI_TEST_ENDPOINT='http://127.0.0.1:9399';
  try {assert.throws(()=>new ListingGenerator('seller-production'));} finally {if(previous===undefined)delete process.env.VINTAGE_AI_TEST_ENDPOINT;else process.env.VINTAGE_AI_TEST_ENDPOINT=previous;}
  assert.throws(()=>proposalSchema.parse({sample:true}));
  assert.throws(()=>moneySchema.parse({currency:'GBP',minor:12.5}));
  assert.throws(()=>snapshotSchema.parse({}));
});
test('normalizes original HEIC on the server, independently of browser preview',async()=>{
  const photo=await normalizePhoto(readFileSync('tests/fixtures/sample.heic'),'image/heic');
  assert.equal(photo.type,'image/jpeg');assert.ok(photo.width>0 && photo.width<=1600);assert.ok(photo.height>0 && photo.height<=1600);
  assert.equal(photo.bytes[0],255);assert.equal(photo.bytes[1],216);
  assert.match(photo.digest,/^[a-f0-9]{64}$/);
});
test('replay rejects gaps and unknown versions; duplicate stage delivery is stable',()=>{
  const state={...initialWorkflow(),status:'reviewing',version:1};
  const event={id:'request',schemaVersion:1,version:1,state};
  assert.deepEqual(reduceWorkflow([event,event]),state);
  assert.throws(()=>reduceWorkflow([{...event,version:2}]));
  assert.throws(()=>reduceWorkflow([{...event,schemaVersion:9}]));
});

test('JPEG orientation is applied to analysis dimensions and metadata is stripped',async()=>{
  const require=createRequire(new URL('../../functions/package.json',import.meta.url));
  const sharp=require('sharp');
  const original=await sharp({create:{width:12,height:24,channels:3,background:'#984831'}}).withMetadata({orientation:6}).jpeg().toBuffer();
  const result=await normalizePhoto(original,'image/jpeg');
  assert.equal(result.width,24);assert.equal(result.height,12);
  const metadata=await sharp(result.bytes).metadata();assert.equal(metadata.orientation,undefined);
});

test('provider sends actual photos and remembered wording instructions and validates photo evidence',async()=>{
  const copy={title:'Red hat',description:'A red hat.',category:'Hats',brand:'',size:'',colour:'Red',material:'',condition:''};
  let evidenceId='p1';let sent;
  const generator=new ListingGenerator('demo-vintage',{transport:async(url,options)=>{
    sent=JSON.parse(options.body);
    const result={copy,confidence:Object.fromEntries(Object.keys(copy).map(f=>[f,0.5])),observations:[{text:'Red knit.',photoIds:[evidenceId]}]};
    return {ok:true,json:async()=>({modelVersion:'test-only',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]})};
  }});
  const input={photos:[{id:'p1'}],context:'Small mark on cuff.',instructions:[{id:'i1',text:'No enthusiastic adjectives.'}],fingerprint:'f'.repeat(64)};
  const proposal=await generator.generate(input,[Buffer.from('image-bytes')]);
  assert.deepEqual(JSON.parse(sent.contents[0].parts[0].text).languageInstructions,['No enthusiastic adjectives.']);
  assert.equal(sent.contents[0].parts[2].inlineData.data,Buffer.from('image-bytes').toString('base64'));
  assert.equal(proposal.copy.title,'Red hat');assert.equal('pricing' in proposal,false);
  evidenceId='unrelated-photo';await assert.rejects(()=>generator.generate(input,[Buffer.from('image-bytes')]));
  generator.transport=async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})});
  await assert.rejects(()=>generator.revise({copy,instructions:input.instructions}));
});

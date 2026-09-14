import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FixtureListingGenerator } from '../../functions/generator.mjs';
import { normalizePhoto } from '../../functions/photos.mjs';
import { proposalSchema, moneySchema, snapshotSchema, reduceWorkflow, initialWorkflow } from '../../functions/shared/proposal.mjs';
test('sample contract is bounded, honest and cannot run in seller production',()=>{
  const proposal=new FixtureListingGenerator('demo-vintage').generate({photos:[{id:'photo'}],examples:[{id:'source'}]});
  assert.equal(proposal.sample,true);assert.equal(proposal.pricing.expectedSaleRange,null);assert.deepEqual(proposal.pricing.estimates,[]);
  assert.deepEqual(proposal.evidence[1].sourceIds,['source']);
  assert.throws(()=>new FixtureListingGenerator('seller-production'));
  assert.throws(()=>proposalSchema.parse({...proposal,model:{...proposal.model,provider:'real'}}));
  assert.throws(()=>moneySchema.parse({currency:'GBP',minor:12.5}));
  assert.throws(()=>moneySchema.parse({currency:'GBP',minor:-1}));
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

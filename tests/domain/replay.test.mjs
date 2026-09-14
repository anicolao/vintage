import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderEvents, reduceListing, validateEvent } from '../../src/lib/events/listing.mjs';
const event = (id, type = 'listing/created', payload = { title: 'Linen jacket' }, extra = {}) => ({ id, streamId:'draft', actorUid:'alice', deviceId:'device', clientSeq:1, correlationId:id, causationId:null, createdAt:{seconds:1,nanoseconds:0}, schemaVersion:2, reducerVersion:1, type, payload, ...extra });
test('replay is pure, ordered and idempotent', () => {
  const created = event('a'); const context = event('b','context/changed',{context:'Saved context'}, { schemaVersion:2 });
  const input = [context,created,context]; const original = structuredClone(input);
  const state = reduceListing(input,'draft','alice');
  assert.equal(state.title,'Linen jacket'); assert.equal(state.context,'Saved context'); assert.equal(state.version,2);
  assert.equal(state.diagnostics.length,1); assert.deepEqual(input,original);
  assert.equal(reduceListing([created, context],'draft','alice').context,state.context);
});
test('timestamps use nanoseconds and IDs; pending events follow acknowledged ones by sequence', () => {
  const a=event('z',undefined,undefined,{createdAt:{seconds:1,nanoseconds:1}});
  const b=event('a',undefined,undefined,{createdAt:{seconds:1,nanoseconds:2}});
  const c=event('c',undefined,undefined,{createdAt:null,clientSeq:2});
  const d=event('d',undefined,undefined,{createdAt:null,clientSeq:1});
  assert.deepEqual(orderEvents([c,b,d,a]).map(e=>e.id),['z','a','d','c']);
  for (const copies of [[{...a,createdAt:null},a],[a,{...a,createdAt:null}]]) {
    const state=reduceListing(copies,'draft','alice'); assert.equal(state.pending,0); assert.equal(state.version,1);
  }
});
test('unknown, malformed, unsupported and foreign events produce diagnostics without corrupting projection', () => {
  const bad=[null, {},event('b','generation/proposed',{}),event('c','context/changed',{context:5}),event('d',undefined,undefined,{schemaVersion:99}),event('e',undefined,undefined,{actorUid:'bob'}),event('f',undefined,undefined,{createdAt:{seconds:1,nanoseconds:-1}})];
  const state=reduceListing([event('a'),...bad],'draft','alice');
  assert.equal(state.title,'Linen jacket'); assert.equal(state.diagnostics.length,bad.length);
  assert.ok(validateEvent(event('x','context/changed',{context:'x'.repeat(2001)})).error);
});
test('pending state never advances acknowledged command version and context requires creation', () => {
  const pending=event('b','context/changed',{context:'Pending'}, {createdAt:null});
  const state=reduceListing([event('a'),pending],'draft','alice');
  assert.equal(state.version,1); assert.equal(state.pending,1); assert.equal(state.context,'Pending');
  assert.equal(reduceListing([pending],'draft','alice').status,'empty');
});

test('photo replacement preserves current order and removal wins over an unfinished replacement', () => {
  const photo = id => ({id,path:`photos/${id}/original`,previewPath:`photos/${id}/original`,type:'image/png',size:100,width:10,height:10,digest:'a'.repeat(64)});
  const events=[event('a'),event('b','photo/uploaded',{photo:photo('one')}),event('c','photo/uploaded',{photo:photo('two')}),event('d','photo/reordered',{photoIds:['two','one']}),event('e','photo/replaced',{photoId:'one',photo:photo('three')})];
  assert.deepEqual(reduceListing(events,'draft','alice').photos.map(p=>p.id),['two','three']);
  events.splice(4,0,event('dd','photo/removed',{photoId:'one'}));
  const state=reduceListing(events,'draft','alice');
  assert.deepEqual(state.photos.map(p=>p.id),['two']);assert.deepEqual(state.diagnostics,[]);
});

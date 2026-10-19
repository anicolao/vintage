import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketImageUrl,loadMarketImage} from '../../functions/market-images.mjs';
import {normalize} from '../../functions/soldgraph.mjs';
const url='https://i.ebayimg.com/images/g/example/s-l225.jpg';
test('preserves provider image and fetches only allowlisted bounded decoded images',async()=>{
 assert.equal(normalize({id:'a',image:url},{from:'2026-01-01',to:'2026-12-31'}).imageUrl,url);
 for(const bad of ['http://i.ebayimg.com/images/a','https://i.ebayimg.com.evil.test/images/a','https://127.0.0.1/images/a','https://user:pass@i.ebayimg.com/images/a']){
  assert.equal(marketImageUrl(bad),null);assert.equal(await loadMarketImage(bad,()=>assert.fail('Must not fetch')),null);
 }
 const image=await loadMarketImage(url,async(u,init)=>{assert.equal(init.redirect,'error');assert.equal(init.headers,undefined);return new Response(readFileSync('static/images/wardrobe.png'));});
 assert.equal(image.digest.length,64);assert.equal(image.bytes[0],255);
 assert.equal(await loadMarketImage(url,async()=>new Response('not an image')),null);
 assert.equal(await loadMarketImage(url,async()=>new Response(Buffer.alloc(5*1024*1024+1))),null);
});

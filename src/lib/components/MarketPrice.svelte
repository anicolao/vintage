<script lang="ts">
  import { onMount } from 'svelte';
  import { doc, onSnapshot } from 'firebase/firestore';
  import { getBackend } from '$lib/firebase';
  import { accountPath } from '$lib/repositories/drafts';
  import { enqueue, locallyPersisted, pipelineIntents, connection, listingFields, type Workflow, type Copy, type Money } from '$lib/state/pipeline';
  import Icon from './Icon.svelte';
  export let uid:string;export let id:string;export let current:Workflow;export let baseVersion:number;
  export let usePrice:(price:Money)=>Promise<void>;
  interface Match {evidenceId:string;title:string;sourceUrl:string;reason:string;soldDate:string;price:Money;condition:string|null;format:string|null;displayedShipping:{amount:string;currency:string}|null}
  interface Research {id:string;status:string;sourceCopy:Copy;baseVersion:number;startedAt:string;collectedAt?:string;query?:string;matches?:Match[];suggestedPrice?:Money|null;comparableRange?:{low:number;high:number}|null;caution?:string;error?:string;fetchedCount?:number;excludedCount?:number}
  let research:Research|null=null;let error='';let sheet:HTMLDialogElement;
  $: queued=$pipelineIntents.some(i=>i.request.kind==='market'&&i.request.listingId===id);
  $: pending=queued||research?.status==='pending';
  $: stale=!!research&&(listingFields.some(f=>research!.sourceCopy[f]!==current.copy?.[f])||research.baseVersion!==baseVersion);
  $: ready=research?.status==='ready'&&!stale&&!queued;
  const pounds=(minor:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(minor/100);
  onMount(()=>onSnapshot(doc(getBackend().db,`${accountPath(uid)}/listings/${id}/pipeline/market`),snapshot=>{research=(snapshot.data() as Research)||null;error='';},()=>error='Price evidence could not be opened. Try reloading.'));
  async function refresh() {
    try {await locallyPersisted();await enqueue({kind:'market',listingId:id,expectedVersion:current.version,copy:structuredClone(current.copy!)});error='';}
    catch {error='Price research could not be saved on this phone. Try again.';}
  }
</script>
<div class="market-research">
  {#if pending}<p role="status">{$connection?'Comparing sold listings…':'Price research saved on this phone. Will start when connected.'} You can keep editing.</p>
  {:else if stale}<p role="status">Item details changed. Refresh price evidence for the current item.</p>
  {:else if ready&&research?.suggestedPrice}
    <p class="recommendation-label">Recommended listing price</p><p class="recommendation-price">{pounds(research.suggestedPrice.minor)}</p>
    <p class="supporting">Based on {research.matches?.length} comparable sold listings. Their displayed prices range from {pounds(research.comparableRange!.low)} to {pounds(research.comparableRange!.high)}, excluding shipping.</p>
    <button class="secondary" onclick={()=>usePrice(research!.suggestedPrice!)}>Use {pounds(research.suggestedPrice.minor)}</button>
  {:else if research?.status==='insufficient'}<p role="status">Not enough comparable sales to recommend a price. You can enter your own.</p>
  {:else if research?.status==='failed'}<p role="status">{research.error}</p>
  {:else}<p class="supporting">Find comparable sold listings to help choose your asking price.</p>{/if}
  {#if research?.matches?.length}<button class="evidence-row" onclick={()=>sheet.showModal()}><span>See price evidence<small>{stale?'Previous item details':'Comparable sold listings and uncertainty'}</small></span><Icon name="next"/></button>{/if}
  {#if ready}<p class="supporting">A starting point, not a predicted sale price. Accepted offers with hidden prices are excluded.</p>{/if}
  {#if !pending}<button class="secondary" onclick={refresh}>{research?'Refresh price evidence':'Research price'}</button>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</div>
<dialog class="evidence-sheet glass" bind:this={sheet} aria-labelledby="price-evidence-title">
  <div class="sheet-handle" aria-hidden="true"></div><header class="sheet-header"><h2 id="price-evidence-title">{research?.suggestedPrice?`Why ${pounds(research.suggestedPrice.minor)}?`:'Price evidence'}</h2><button class="icon-button secondary" aria-label="Close price evidence" onclick={()=>sheet.close()}><Icon name="close"/></button></header>
  {#if stale}<p role="status">This evidence relates to previous item details.</p>{/if}
  <p class="supporting">Median displayed price of comparable eBay sold listings found through Soldgraph. These are not verified paid prices. Shipping is separate.</p>
  {#if research?.collectedAt}<p class="supporting">Observed {new Date(research.collectedAt).toLocaleDateString('en-GB')}. Search: {research.query}. One page of {research.fetchedCount} listings; {research.excludedCount} excluded before relevance analysis.</p>{/if}
  {#each research?.matches||[] as match}<article class="comparable-row"><p class="comparable-price">Sold · {pounds(match.price.minor)}</p><a href={match.sourceUrl} target="_blank" rel="noopener noreferrer">{match.title}</a><p class="supporting">{match.condition||'Condition unavailable'} · {match.format==='auction'?'Auction':match.format==='fixed_price'?'Fixed price':'Format unavailable'} · Sold {match.soldDate}</p><p>{match.reason}</p><p class="supporting">Shipping: {match.displayedShipping?`${match.displayedShipping.amount} ${match.displayedShipping.currency}`:'unavailable'}</p></article>{/each}
  {#if research?.caution}<p class="supporting">{research.caution}</p>{/if}
  <p class="supporting">AI matching may be wrong. Check the source listings. Expected sale range, sale probability and time to sale are unavailable.</p>
</dialog>

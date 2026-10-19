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
  type CriterionId='brand'|'category'|'material'|'colour'|'size'|'condition';
  type Condition='new'|'open_box'|'refurbished'|'used'|'for_parts';
  interface Criterion {id:CriterionId;value:string;enabled:boolean;excludedCount:number;restoredCount:number}
  interface Research {visualComparisonVersion?:string;visualCaution?:string;missingPhotoCount?:number;anchor?:{evidenceId:string;title:string;sourceUrl:string;imageUrl?:string;price:Money;reason:string}|null;pricing?:{direction:'above'|'below'|'same';adjustmentMinor:number;reason:string;distribution:{count:number;below:number;equal:number;above:number}}|null;assessmentFailures?:{failedCriteria:CriterionId[];unsafe:boolean}[];criteria?:Criterion[];condition?:Condition|null;eligibleCount?:number;matchingCount?:number;unsafeCount?:number;id:string;status:string;sourceCopy:Copy;baseVersion:number;startedAt:string;collectedAt?:string;query?:string;matches?:Match[];suggestedPrice?:Money|null;comparableRange?:{low:number;high:number}|null;caution?:string;error?:string;fetchedCount?:number;excludedCount?:number}
  let research:Research|null=null;let error='';let sheet:HTMLDialogElement;
  let editorId='';let searchWords:string[]=[];let selectedWords:string[]=[];let selectedCriteria:CriterionId[]=[];let keepCondition=true;
  $: if(research && editorId!==research.id && research.status!=='pending'){editorId=research.id;searchWords=[...new Set((research.query||'').split(/\s+/).filter(Boolean))];selectedWords=[...searchWords];selectedCriteria=(research.criteria||[]).filter(c=>c.enabled).map(c=>c.id);keepCondition=true;}
  $: retrievalChanged=!!research&&(selectedWords.join(' ')!==searchWords.join(' ')||(!keepCondition&&!!research.condition));
  $: criteriaChanged=!!research?.criteria&&research.criteria.some(c=>c.enabled!==selectedCriteria.includes(c.id));
  function restoredCount(id:CriterionId){return (research?.assessmentFailures||[]).filter(r=>!r.unsafe&&r.failedCriteria.includes(id)&&r.failedCriteria.every(f=>f===id||!selectedCriteria.includes(f))).length;}
  $: previewMatches=(research?.assessmentFailures||[]).filter(r=>!r.unsafe&&!r.failedCriteria.some(f=>selectedCriteria.includes(f))).length;
  function toggleCriterion(id:CriterionId){selectedCriteria=selectedCriteria.includes(id)?selectedCriteria.filter(v=>v!==id):[...selectedCriteria,id];}
  function toggleWord(word:string){selectedWords=selectedWords.includes(word)?selectedWords.filter(v=>v!==word):searchWords.filter(v=>v===word||selectedWords.includes(v));}
  async function broaden(){
    if(!research||!selectedWords.length)return;
    try {await locallyPersisted();await enqueue({kind:'market',listingId:id,expectedVersion:current.version,copy:structuredClone(current.copy!),refinement:{sourceId:research.id,query:selectedWords.join(' ')===searchWords.join(' ')?research.query!:selectedWords.join(' '),condition:keepCondition?(research.condition||null):null,enabledCriteria:[...selectedCriteria]}});error='';}
    catch {error='Broader comparison could not be saved on this phone. Try again.';}
  }
  $: queued=$pipelineIntents.some(i=>i.request.kind==='market'&&i.request.listingId===id);
  $: pending=queued||research?.status==='pending';
  $: stale=!!research&&(listingFields.some(f=>research!.sourceCopy[f]!==current.copy?.[f])||research.baseVersion!==baseVersion);
  $: ready=research?.status==='ready'&&research.visualComparisonVersion==='photo-comparison-v1'&&!!research.anchor&&!!research.pricing&&!stale&&!queued;
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
  {:else if research&&['ready','insufficient'].includes(research.status)&&research.visualComparisonVersion!=='photo-comparison-v1'}<p role="status">Refresh price evidence to compare the actual photos.</p>
  {:else if ready&&research?.suggestedPrice}
    <p class="recommendation-label">Recommended listing price</p><p class="recommendation-price">{pounds(research.suggestedPrice.minor)}</p>
    <p class="supporting">Based on {research.pricing?.distribution.count||research.matches?.length} comparable sold listings. Their displayed prices range from {pounds(research.comparableRange!.low)} to {pounds(research.comparableRange!.high)}, excluding shipping.</p>
    {#if research.anchor&&research.pricing}
      <p class="supporting">Closest comparable: <a href={research.anchor.sourceUrl} target="_blank" rel="noopener noreferrer">{research.anchor.title}</a> · {pounds(research.anchor.price.minor)}</p>
      {#if research.anchor.imageUrl}<img class="anchor-photo" src={research.anchor.imageUrl} alt="Selected comparable" referrerpolicy="no-referrer" />{/if}
      <p>{research.anchor.reason}</p>
      <p class="supporting">{research.pricing.direction==='same'?'Same price as the closest comparable':`${pounds(Math.abs(research.pricing.adjustmentMinor))} ${research.pricing.direction} the closest comparable`}.</p>
      <p>{research.pricing.reason}</p>
    {/if}
    <button class="secondary" onclick={()=>usePrice(research!.suggestedPrice!)}>Use {pounds(research.suggestedPrice.minor)}</button>
  {:else if research?.status==='insufficient'}<p role="status">Not enough comparable sales to recommend a price. You can enter your own.</p>
    <section class="broaden-search" aria-label="Broaden price comparison">
      <h3>Broaden the comparison</h3>
      {#if research.visualCaution}<p>{research.visualCaution}</p>{/if}
      {#if research.missingPhotoCount}<p class="supporting">{research.missingPhotoCount} listings have no usable comparison photo.</p>{/if}
      <p class="supporting">Searched “{research.query}”{research.condition?` · ${research.condition.replace('_',' ')}`:''}. Found {research.fetchedCount} listings; {research.eligibleCount} have usable prices.</p>
      {#if research.criteria}
        <fieldset><legend>Search words</legend>
          {#each searchWords as word}<label><input type="checkbox" checked={selectedWords.includes(word)} onchange={()=>toggleWord(word)}/><span>{word}</span></label>{/each}
          {#if research.condition}<label><input type="checkbox" bind:checked={keepCondition}/><span>Condition: {research.condition.replace('_',' ')}</span></label>{/if}
        </fieldset>
        <p class="supporting">Changing these starts a new search. Exclusions outside the returned page are unknown.</p>
        <fieldset><legend>Details to match</legend>
          {#each research.criteria as criterion}<label><input type="checkbox" checked={selectedCriteria.includes(criterion.id)} onchange={()=>toggleCriterion(criterion.id)}/><span>{criterion.value}<small>{criterion.id} · excludes {criterion.excludedCount}{selectedCriteria.includes(criterion.id)?` · unchecking adds ${restoredCount(criterion.id)}`:''}</small></span></label>{/each}
        </fieldset>
        <p class="supporting">AI-assessed counts from this page. A listing can fail several details, so counts overlap. “Adds” uses your current checkbox choices. Unchecking a detail leaves your listing unchanged.</p>
        <p class="supporting">{research.excludedCount} listings lack usable prices; {research.unsafeCount||0} are unsuitable items. These exclusions cannot be relaxed.</p>
        {#if retrievalChanged}<p class="supporting">A new search uses one search credit. Current counts will be recalculated.</p>{:else}<p class="supporting">{previewMatches} listings match these choices. Reuses these results. No additional search credit.</p>{/if}
        <button class="secondary" disabled={!selectedWords.length||(!retrievalChanged&&!criteriaChanged)} onclick={broaden}>{retrievalChanged?'Search with these choices':'Compare with these choices'}</button>
      {:else}<p class="supporting">Refresh price evidence to assess which details exclude matches.</p>{/if}
      {#if research.caution}<p class="supporting">{research.caution}</p>{/if}
    </section>
  {:else if research?.status==='failed'}<p role="status">{research.error}</p>
  {:else}<p class="supporting">Find comparable sold listings to help choose your asking price.</p>{/if}
  {#if research?.visualComparisonVersion==='photo-comparison-v1'&&research?.matches?.length}<button class="evidence-row" onclick={()=>sheet.showModal()}><span>See price evidence<small>{stale?'Previous item details':'Comparable sold listings and uncertainty'}</small></span><Icon name="next"/></button>{/if}
  {#if ready&&research?.criteria?.some(c=>!c.enabled)}<p class="supporting">{research.caution}</p>{/if}
  {#if ready}<p class="supporting">{research?.visualCaution}</p><p class="supporting">A starting point, not a predicted sale price. Accepted offers with hidden prices are excluded.</p>{/if}
  {#if !pending}<button class="secondary" onclick={refresh}>{research?'Refresh price evidence':'Research price'}</button>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</div>
<dialog class="evidence-sheet glass" bind:this={sheet} aria-labelledby="price-evidence-title">
  <div class="sheet-handle" aria-hidden="true"></div><header class="sheet-header"><h2 id="price-evidence-title">{research?.suggestedPrice?`Why ${pounds(research.suggestedPrice.minor)}?`:'Price evidence'}</h2><button class="icon-button secondary" aria-label="Close price evidence" onclick={()=>sheet.close()}><Icon name="close"/></button></header>
  {#if stale}<p role="status">This evidence relates to previous item details.</p>{/if}
  <p class="supporting">Anchored to the closest AI-assessed comparable among eBay sold listings found through Soldgraph. These are not verified paid prices. Shipping is separate.</p>
  {#if research?.collectedAt}<p class="supporting">Observed {new Date(research.collectedAt).toLocaleDateString('en-GB')}. Search: {research.query}. One page of {research.fetchedCount} listings; {research.excludedCount} excluded before relevance analysis.</p>{/if}
  {#if research?.anchor&&research.pricing}<h3>Closest comparable</h3><a href={research.anchor.sourceUrl} target="_blank" rel="noopener noreferrer">{research.anchor.title}</a><p>{research.anchor.reason}</p><h3>Why this price?</h3><p>{research.pricing.reason}</p><p class="supporting">In the comparison set, {research.pricing.distribution.below} prices are lower, {research.pricing.distribution.equal} are equal, and {research.pricing.distribution.above} are higher than the recommendation. Adjustments use a neighboring observed price within 20% of the closest comparable; otherwise its own price is retained.</p>{/if}
  {#each research?.matches||[] as match}<article class="comparable-row"><p class="comparable-price">Sold · {pounds(match.price.minor)}</p><a href={match.sourceUrl} target="_blank" rel="noopener noreferrer">{match.title}</a><p class="supporting">{match.condition||'Condition unavailable'} · {match.format==='auction'?'Auction':match.format==='fixed_price'?'Fixed price':'Format unavailable'} · Sold {match.soldDate}</p><p>{match.reason}</p><p class="supporting">Shipping: {match.displayedShipping?`${match.displayedShipping.amount} ${match.displayedShipping.currency}`:'unavailable'}</p></article>{/each}
  {#if research?.caution}<p class="supporting">{research.caution}</p>{/if}
  <p class="supporting">AI matching may be wrong. Check the source listings. Expected sale range, sale probability and time to sale are unavailable.</p>
</dialog>

<style>
  .anchor-photo { width: 100%; max-width: 220px; max-height: 220px; object-fit: contain; border-radius: 1rem; }
  .broaden-search { margin-block: 1rem; }
  fieldset { border: 0; padding: 0; margin: 1rem 0; min-width: 0; }
  legend { font-weight: 600; margin-bottom: .5rem; }
  label { display: flex; align-items: center; gap: .75rem; min-height: 48px; padding-block: .35rem; cursor: pointer; }
  input[type=checkbox] { width: 1.25rem; height: 1.25rem; min-height: 0; padding: 0; flex: 0 0 auto; accent-color: var(--accent); }
  .broaden-search small { display: block; font-size: .8rem; line-height: 1.4; }
</style>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { photoJobs } from '$lib/state/photos';
  import { reduceListing } from '$lib/events/listing.mjs';
  import { watchListing } from '$lib/repositories/drafts';
  import { enqueue, locallyPersisted, workflows, pipelineSaving, pipelineIntents, connection, instructions, listingFields, type Workflow, type ListingField, type Copy, type Snapshot } from '$lib/state/pipeline';
  import type { Photo } from '$lib/events/contracts';
  import AccountMenu from './AccountMenu.svelte';
  import PhotoTile from './PhotoTile.svelte';
  import Icon from './Icon.svelte';
  import PipelineStatus from './PipelineStatus.svelte';
  export let id:string;export let uid:string;export let workflow:Workflow;
  let capturedPhotos:Photo[]=[];
  let feedback='';
  let values:Copy;let fieldBases:Partial<Copy>={};let price='';let activeField='';let seenVersion=-1;let baseVersion=0;let error='';
  let evidenceDialog:HTMLDialogElement;let inspected='';let inspectedAlt='';let full=false;let copied=false;let manual=false;let copyArea:HTMLTextAreaElement;
  $: current=$workflows[id] || workflow;
  $: if(current.copy && current.version!==seenVersion) {
    const retained=activeField && values ? values[activeField as ListingField] : undefined;
    values={...current.copy};if(retained!==undefined)values[activeField as ListingField]=retained;
    if(activeField!=='price')price=current.price ? (current.price.minor/100).toFixed(2) : '';
    for (const field of listingFields) if(activeField!==field)fieldBases[field]=current.copy[field];
    seenVersion=current.version;
  }
  $: validPrice=/^\d{1,6}(\.\d{1,2})?$/.test(price) && Number(price)>0 && Number(price)<=100000;
  $: approved=current.approved;
  $: submitted=current.status==='approved' || current.status==='approval-pending';
  $: pendingGeneration=$pipelineIntents.find(i=>i.request.kind==='generate' && i.request.listingId===id);
  $: pinnedIds=pendingGeneration?.request.kind==='generate' ? pendingGeneration.request.photoIds : [];
  $: queuedPhoto=$photoJobs.find(j=>j.photo.uid===uid && j.photo.listingId===id && pinnedIds.includes(j.photo.id));
  $: photos=submitted ? approved?.photos || [] : pendingGeneration ? capturedPhotos.filter(p=>pinnedIds.includes(p.id)) : current.input?.photos || [];
  $: text=approved ? `${approved.copy.title}\n\n${approved.copy.description}\n\n${listingFields.slice(2).map(f=>`${label(f)}: ${approved.copy[f]}`).join('\n')}\n\n£${(approved.price.minor/100).toFixed(2)}` : '';
  onMount(()=>watchListing(uid,id,events=>{capturedPhotos=reduceListing(events,id,uid).photos;baseVersion=events.filter(e=>(e as {createdAt:unknown}).createdAt).length;},()=>error='The latest photo version could not be checked. Try again.'));
  function label(field:string) {return field[0].toUpperCase()+field.slice(1);}
  async function edit(field:ListingField,value:string) {
    const previousValue=fieldBases[field] ?? values[field];
    fieldBases[field]=value; values={...values,[field]:value};
    try {await enqueue({kind:'edit',listingId:id,expectedVersion:current.version,field,value,previousValue});error='';}catch{error='Not saved on this phone. Keep this page open and try again.';}
  }
  async function choosePrice() {
    if(!/^\d{1,6}(\.\d{1,2})?$/.test(price) || Number(price)<=0 || Number(price)>100000) {error='Enter a price between £0.01 and £100,000, using at most two decimal places.';return;}
    try{await enqueue({kind:'price',listingId:id,expectedVersion:current.version,price:{currency:'GBP',minor:Math.round(Number(price)*100)}});error='';}catch{error='The price could not be saved on this phone.';}
  }
  async function approve() {
    await locallyPersisted(); await tick();
    if(error || !values.title.trim() || !values.description.trim() || !validPrice || !current.price || current.revision?.status==='pending') {error='Check the title, description and price before approval.';return;}
    const snapshot:Snapshot={copy:{...values},price:{currency:'GBP',minor:Math.round(Number(price)*100)},photos:structuredClone(photos),proposalId:current.proposalId,model:current.proposal!.model};
    try{await enqueue({kind:'approve',listingId:id,expectedVersion:current.version,baseVersion,snapshot});}catch{error='Approval could not be saved on this phone. Try again.';}
  }
  async function applyFeedback() {
    const text=feedback.trim();if(!text || current.revision?.status==='pending')return;
    await locallyPersisted();
    try {await enqueue({kind:'feedback',listingId:id,expectedVersion:current.version,text,previousCopy:{title:values.title,description:values.description}});feedback='';error='';}
    catch {error='Feedback could not be saved on this phone. Keep this page open and try again.';}
  }
  async function forget(instructionId:string) {
    try {await enqueue({kind:'forget',listingId:id,expectedVersion:current.version,instructionId});}catch{error='The instruction could not be removed. Try again.';}
  }
  function showEvidence() {inspected='';evidenceDialog.showModal();}
  function inspect(photo:Photo,url:string) {inspected=url;inspectedAlt=`Item photo ${photos.findIndex(p=>p.id===photo.id)+1}`;evidenceDialog.showModal();}
  async function copy() {try{await navigator.clipboard.writeText(text);copied=true;}catch{full=true;manual=true;await tick();copyArea.focus();copyArea.select();}}
</script>
<main class="flow-screen review-screen" data-status="ready" data-sync={$pipelineSaving || $pipelineIntents.length ? 'pending' : 'synced'} data-e2e-layout data-workflow={current.status}>
<header class="step-header glass"><a class="icon-button" href="/" aria-label="Your listings"><Icon name="back"/></a><span>{submitted?(current.status==='approved'?'Approved listing':'Approval pending'):current.status==='generating'?'2 of 3 · Create draft':'3 of 3 · Review'}</span><AccountMenu/></header>
{#if current.proposal && current.proposal.schemaVersion!==2}
  <h1>Create a new draft</h1><p>This draft was created with a retired generator. Start again from your photos to get an analysed proposal.</p><a class="button" href={`/listings/${id}?view=photos`}>Back to photos</a>
{:else if submitted && approved}
  <div class="approved-intro"><span class="success-orb"><Icon name={current.status==='approved'?'check':'cloud'} size={30}/></span><h1>{current.status==='approved'?'Ready to copy':'Approval pending'}</h1><p>{current.status==='approved'?'Your approved version is saved.':'This exact version is saved on this phone. Approval will be confirmed when it syncs.'}</p></div>
  <section class="glass approved-item"><div class="approved-photo">{#if photos[0]}<PhotoTile photo={photos[0]} position={1} open={inspect}/>{/if}</div><div><h2>{approved.copy.title}</h2><p class="approved-price">£{(approved.price.minor/100).toFixed(2)}</p></div></section>
  <section class="glass flow-card"><h2>Listing text</h2><p class="approved-description">{approved.copy.description}</p><button class="evidence-row" onclick={()=>full=!full} aria-expanded={full}>View full listing<Icon name="next"/></button>
    {#if full}<textarea class="copy-text" readonly bind:this={copyArea} value={text} rows="14" aria-label="Approved listing text"></textarea>{/if}
  </section>
  {#if current.status==='approved'}<button onclick={copy}>{copied?'Copied':'Copy listing'}<Icon name={copied?'check':'copy'}/></button>{/if}
  {#if manual}<p role="status">Copy is unavailable here. Select the listing text and copy it manually.</p><button class="secondary" onclick={()=>{copyArea.focus();copyArea.select();}}>Select listing text</button>{/if}
  <a class="button secondary" href="/">Your listings</a><p class="quiet-status">Paste it into Vinted when you're ready.</p>
{:else if current.status==='generating' || current.status==='failed'}
  <h1>{current.status==='failed'?"We couldn't finish this draft":'Building your draft'}</h1>

  {#if photos[0]}<div class="progress-photo"><PhotoTile photo={photos[0]} position={1} open={inspect}/></div>{:else if queuedPhoto && !/hei[cf]/i.test(queuedPhoto.photo.file.type)}<img class="progress-local-photo" src={queuedPhoto.url} alt="Selected item"/>{/if}
  <section class="glass flow-card">
    {#if $pipelineIntents.some(i=>i.request.kind==='generate' && i.request.listingId===id)}<p role="status">{$connection?'Waiting for photos to sync':'Will start when connected'}</p>{/if}
    <p class="supporting">Later photo or context edits are kept for your next proposal.</p>
    <ol class="stage-list">{#each ['Preparing photos','Writing your draft','Saving your draft'] as name,index}<li class:stage-done={(current.stage || 0)>index}><span class="stage-number">{#if (current.stage || 0)>index}<Icon name="check" size={18}/>{:else}{index+1}{/if}</span>{name}</li>{/each}</ol>
    {#if current.error}<p role="alert">{current.error}</p>{/if}
  </section>
  <a class="button secondary" href={`/listings/${id}?view=photos`}>{current.status==='failed'?'Try again':'Keep editing'}</a><a class="text-link" href="/">Your listings</a>
{:else if current.proposal && values}
  <nav class="review-filmstrip" aria-label="Listing photos">{#each photos as photo,index}<div><PhotoTile {photo} position={index+1} open={inspect}/></div>{/each}</nav>
  <p class="supporting">Check the suggested details against your item before approving.</p>
  <section class="glass flow-card"><h1 class="section-title">Listing proposal</h1>
    {#each ['title','description'] as field}{@const key=field as ListingField}<div class="review-field"><label for={`review-${field}`}>{label(field)}</label>
    {#if field==='description'}<textarea id={`review-${field}`} bind:value={values[key]} onfocus={()=>activeField=field} onblur={()=>activeField=''} oninput={()=>edit(key,values[key])} rows="5" maxlength="5000"></textarea>{:else}<input id={`review-${field}`} bind:value={values[key]} onfocus={()=>activeField=field} onblur={()=>activeField=''} oninput={()=>edit(key,values[key])} maxlength="200"/>{/if}
    {#if values[key]!==current.proposal.copy[key]}<button class="restore-button" onclick={()=>edit(key,current.proposal!.copy[key])} aria-label={`Restore ${field} suggestion`}>Restore suggestion</button>{/if}</div>{/each}
    <p class="supporting">Blank fields could not be identified. Check any uncertain suggestions.</p>
    <div class="attribute-grid">{#each listingFields.slice(2) as field}<div class="review-field"><label for={`review-${field}`}>{label(field)}</label><input id={`review-${field}`} bind:value={values[field]} maxlength="200" onfocus={()=>activeField=field} onblur={()=>activeField=''} oninput={()=>edit(field,values[field])}/>{#if current.proposal.confidence[field]<0.8}<small>Check {field}</small>{/if}{#if values[field]!==current.proposal.copy[field]}<button class="restore-button" onclick={()=>edit(field,current.proposal!.copy[field])} aria-label={`Restore ${field} suggestion`}>Restore suggestion</button>{/if}</div>{/each}</div>
    <button class="evidence-row" onclick={()=>showEvidence()}><Icon name="camera"/><span>Check size, labels and wear<small>Photo observations and uncertainty</small></span><Icon name="next"/></button>
  </section>
  <section class="glass flow-card language-feedback"><h2>How should it sound?</h2>
    <label for="language-feedback">Language feedback</label><textarea id="language-feedback" bind:value={feedback} maxlength="1000" rows="3" placeholder="e.g. Keep it short and factual"></textarea>
    <p class="supporting">Applies to this draft and future listings.</p>
    <button disabled={!feedback.trim() || current.revision?.status==='pending'} onclick={applyFeedback}>Apply feedback</button>
    {#if current.revision?.status==='pending'}<p role="status">{$connection?'Revising wording…':'Feedback saved on this phone. Will revise when connected.'} You can keep editing.</p>
    {:else if current.revision?.status==='applied'}<p role="status">Wording updated. Feedback remembered.</p>
    {:else if current.revision?.status==='conflict'}<p role="status">Your wording changed during revision. Your edits are kept. Apply feedback again to revise the latest text.</p>
    {:else if current.revision?.status==='failed'}<p role="alert">Wording could not be revised. Your draft and feedback are saved.</p><button class="secondary" onclick={()=>{feedback=current.revision!.text;}}>Use feedback again</button>{/if}
    {#if $instructions.length}<details><summary>Remembered feedback</summary>{#each $instructions as instruction}<div class="remembered-instruction"><p>{instruction.text}</p><button class="text-button" aria-label={`Forget instruction: ${instruction.text}`} onclick={()=>forget(instruction.id)}>Forget</button></div>{/each}</details>{/if}
  </section>
  <section class="glass flow-card price-card"><h2>Listing price</h2><label class="price-label" for="listing-price"><span aria-hidden="true">£</span><input id="listing-price" aria-label="Listing price in GBP" inputmode="decimal" bind:value={price} onfocus={()=>activeField='price'} onblur={()=>activeField=''} oninput={choosePrice}/></label>
    <p class="supporting">Enter your asking price. Market-backed recommendations are not available yet.</p>
  </section>
  {#if current.input && baseVersion!==current.input.baseVersion}<p role="status">Photos or context changed after this proposal. Create another proposal from the updated photos before approving.</p>{/if}
  <button disabled={!validPrice || !current.price || current.revision?.status==='pending' || (!!current.input && baseVersion!==current.input.baseVersion)} onclick={approve}>Approve listing<Icon name="check"/></button><a class="text-link" href={`/listings/${id}?view=photos`}>Edit photos or create another proposal</a>
{/if}
{#if error}<p role="alert">{error}</p>{/if}<PipelineStatus/>
</main>
<dialog class="evidence-sheet glass" bind:this={evidenceDialog} aria-labelledby="evidence-title"><div class="sheet-handle" aria-hidden="true"></div><header class="sheet-header"><h2 id="evidence-title">Your photo evidence</h2><button class="icon-button secondary" aria-label="Close evidence" onclick={()=>evidenceDialog.close()}><Icon name="close"/></button></header>
{#if inspected}<img class="evidence-photo" src={inspected} alt={inspectedAlt}/>{:else}{#each photos as photo,index}<PhotoTile {photo} position={index+1} open={(_,url)=>{inspected=url;inspectedAlt=`Item photo ${index+1}`;}}/>{/each}{/if}
{#each current.proposal?.observations || [] as observation}<p>{observation.text}<small> · {observation.photoIds.map(id=>`Photo ${photos.findIndex(p=>p.id===id)+1}`).join(', ')}</small></p>{/each}
<p class="supporting">AI observations may be wrong. Check the photos and item.</p>
</dialog>

<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { style, enqueue, pipelineSaving, pipelineResolution, pipelineIntents, connection, type Example } from '$lib/state/pipeline';
  import AccountGate from '$lib/components/AccountGate.svelte';
  import AccountMenu from '$lib/components/AccountMenu.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PipelineStatus from '$lib/components/PipelineStatus.svelte';
  let rows:Example[]=[];let exampleBase:Example[]=[];let editing=false;let validation=false;let error='';let removed:{example:Example;index:number}|null=null;
  $: if($pipelineResolution.startsWith('style/')) {editing=false;validation=false;removed=null;}
  $: destination=$page.url.searchParams.get('item');
  $: returnUrl=destination && /^[a-zA-Z0-9-]+$/.test(destination) ? `/listings/${destination}?view=photos` : '/?account=open';
  $: learning=$page.url.searchParams.get('view')==='learning';
  $: if (!editing) { exampleBase=structuredClone($style.examples); rows=$style.examples.length ? structuredClone($style.examples) : [{id:crypto.randomUUID(),title:'',description:''}]; }
  async function save() {editing=true;const previousExamples=exampleBase;exampleBase=structuredClone(rows);try {await enqueue({kind:'examples',examples:structuredClone(rows),previousExamples,expectedVersion:$style.version});error='';} catch{error='Not saved on this phone. Keep this page open and try again.';}}
  async function learn() {
    validation=true;if(!rows.length || rows.some(e=>!e.title.trim() || !e.description.trim()))return;
    await save();if(error)return;
    try {await enqueue({kind:'learn',expectedVersion:$style.version});await goto(`/style?view=learning${destination ? `&item=${encodeURIComponent(destination)}`:''}`);}catch{error='Your request could not be saved. Try again.';}
  }
  async function remove(index:number) {removed={example:rows[index],index};rows=rows.filter((_,i)=>i!==index);await save();}
</script>
<svelte:head><title>Your listing style — Vintage</title></svelte:head>
<AccountGate><main class="flow-screen" data-status="ready" data-sync={$pipelineSaving || $pipelineIntents.length ? 'pending' : 'synced'} data-e2e-layout>
<header class="step-header glass"><a class="icon-button" href={returnUrl} aria-label={destination?'Back to photos':'Back to account'}><Icon name="back"/></a><span>Your listing style</span><AccountMenu/></header>
{#if learning}
  <h1>{$style.status==='ready'?'Your examples are ready':'Learning your style'}</h1>
  <p class="sample-notice">Sample preview · Examples are saved, but personal style analysis is not enabled yet.</p>
  <section class="glass flow-card"><ol class="stage-list">{#each [`Reading ${$style.examples.length} examples`,'Finding your tone','Saving your style'] as stage,index}<li class:stage-done={($style.stage || 0)>index}><span class="stage-number">{#if ($style.stage || 0)>index}<Icon name="check" size={18}/>{:else}{index+1}{/if}</span><span>{stage}{#if index===1}<small>Sample style profile</small>{/if}</span></li>{/each}</ol>
  {#if !$connection}<p role="status">Will start when connected</p>{/if}
  {#if $style.status==='failed'}<p role="alert">{$style.error}</p><button onclick={learn}>Try again</button>{/if}
  </section>
  {#each $style.examples.slice(0,2) as example}<blockquote class="glass example-excerpt"><strong>{example.title}</strong><p>{example.description}</p></blockquote>{/each}
  <a class="button" href={returnUrl}>{destination ? ($style.status==='ready'?'Continue to photos':'Back to photos'):'Back to account'}</a>
  <a class="text-link" href={`/style${destination?`?item=${encodeURIComponent(destination)}`:''}`}>Edit examples</a>
{:else}
  <div><h1>Make it sound like you</h1><p class="supporting">Paste a listing you've written. You can add more examples later.</p></div>
  {#each rows as example,index (example.id)}<section class="glass flow-card example-card"><header><h2>Example {index+1}</h2><button class="icon-button secondary" aria-label={`Remove example ${index+1}`} onclick={()=>remove(index)}><Icon name="close" size={18}/></button></header>
    <label for={`example-title-${example.id}`}>Title</label><input id={`example-title-${example.id}`} bind:value={example.title} maxlength="200" oninput={save} aria-invalid={validation&&!example.title.trim()} />
    {#if validation&&!example.title.trim()}<p class="field-error">Add the listing title.</p>{/if}
    <label for={`example-description-${example.id}`}>Description</label><textarea id={`example-description-${example.id}`} bind:value={example.description} maxlength="5000" rows="5" oninput={save} aria-invalid={validation&&!example.description.trim()}></textarea>
    {#if validation&&!example.description.trim()}<p class="field-error">Add the listing description.</p>{/if}
  </section>{/each}
  {#if removed}<div class="undo-notice glass" role="status"><span>Example removed</span><button class="text-button" onclick={()=>{if(removed){rows.splice(removed.index,0,removed.example);rows=[...rows];removed=null;void save();}}}>Undo</button></div>{/if}
  {#if validation&&!rows.length}<p role="alert">Add one complete example to begin.</p>{/if}
  <button class="secondary" disabled={rows.length>=20} onclick={()=>{rows=[...rows,{id:crypto.randomUUID(),title:'',description:''}];void save();}}><Icon name="plus"/>Add another example</button>
  <button onclick={learn}>Learn my style <Icon name="next"/></button>
  <p class="quiet-status">Your examples stay private to your account.</p>
{/if}
{#if error}<p role="alert">{error}</p>{/if}<PipelineStatus/>
</main></AccountGate>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { pipelineIntents, pipelineSaving, pipelineError, connection, flush, useLatest } from '$lib/state/pipeline';
  let confirm:HTMLDialogElement;
  $: conflicted=$pipelineIntents.find(i=>i.error);
  $: conflict=conflicted?.error;
  $: duplicate=conflicted?.request.kind==='duplicate';
  let recoveryError='';
  async function resolve() {
    const source=conflicted?.request.kind==='duplicate' ? conflicted.request.sourceListingId : '';
    try {await useLatest();confirm.close();if(source)await goto(`/listings/${source}`);}
    catch {recoveryError='Your changes could not be removed from this phone. Try again.';}
  }
</script>
{#if conflict}<div class="sync-banner glass"><div><p role="alert">{conflict}</p><button class="secondary" onclick={()=>confirm.showModal()}>{duplicate?'Review duplicate conflict':'Review latest version'}</button></div></div>
{:else if $pipelineError}<div class="sync-banner glass"><div><p role="alert">{$pipelineError}</p><button class="secondary" onclick={()=>flush()}>Try again</button></div></div>
{:else if $pipelineSaving}<p class="quiet-status" role="status">Saving on this phone…</p>
{:else if $pipelineIntents.length}<p class="quiet-status" role="status">{$connection ? 'Saved on this phone · Syncing' : 'Saved on this phone · Will start when connected'}</p>{/if}
<dialog class="account-sheet glass" bind:this={confirm} aria-labelledby="conflict-title"><h2 id="conflict-title">{duplicate?'Discard this duplicate?':'Review the newer version?'}</h2><p>{duplicate?'The original changed before this duplicate synced. Discard this local duplicate and its edits to return to the original.':'The conflicting change and later edits to the same item will be discarded. Review the saved version before making further changes.'}</p>{#if recoveryError}<p role="alert">{recoveryError}</p>{/if}<button onclick={resolve}>{duplicate?'Discard duplicate':'Use latest version'}</button><button class="secondary" onclick={()=>confirm.close()}>Keep my edits</button></dialog>

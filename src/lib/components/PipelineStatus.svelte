<script lang="ts">
  import { pipelineIntents, pipelineSaving, pipelineError, connection, flush, useLatest } from '$lib/state/pipeline';
  let confirm:HTMLDialogElement;
  $: conflict=$pipelineIntents.find(i=>i.error)?.error;
</script>
{#if conflict}<div class="sync-banner glass"><div><p role="alert">{conflict}</p><button class="secondary" onclick={()=>confirm.showModal()}>Review latest version</button></div></div>
{:else if $pipelineError}<div class="sync-banner glass"><div><p role="alert">{$pipelineError}</p><button class="secondary" onclick={()=>flush()}>Try again</button></div></div>
{:else if $pipelineSaving}<p class="quiet-status" role="status">Saving on this phone…</p>
{:else if $pipelineIntents.length}<p class="quiet-status" role="status">{$connection ? 'Saved on this phone · Syncing' : 'Saved on this phone · Will start when connected'}</p>{/if}
<dialog class="account-sheet glass" bind:this={confirm} aria-labelledby="conflict-title"><h2 id="conflict-title">Review the newer version?</h2><p>The conflicting change and later edits to the same item will be discarded. Review the saved version before making further changes.</p><button onclick={async()=>{await useLatest();confirm.close();}}>Use latest version</button><button class="secondary" onclick={()=>confirm.close()}>Keep my edits</button></dialog>

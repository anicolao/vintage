<script lang="ts">
  import { pipelineIntents, pipelineError, connection, flush, useLatest } from '$lib/state/pipeline';
  let confirm:HTMLDialogElement;
  $: conflict=$pipelineIntents.find(i=>i.error)?.error;
</script>
{#if conflict}<div class="sync-banner glass"><div><p role="alert">{conflict}</p><button class="secondary" onclick={()=>confirm.showModal()}>Review latest version</button></div></div>
{:else if $pipelineError}<div class="sync-banner glass"><div><p role="alert">{$pipelineError}</p><button class="secondary" onclick={()=>flush()}>Try again</button></div></div>
{:else if $pipelineIntents.length}<p class="quiet-status" role="status">{$connection ? 'Saved on this phone · Syncing' : 'Saved on this phone · Will start when connected'}</p>{/if}
<dialog class="account-sheet glass" bind:this={confirm} aria-labelledby="conflict-title"><h2 id="conflict-title">Review the newer version?</h2><p>Your unconfirmed edits on this device will be discarded. The saved photos and latest cloud version will remain.</p><button onclick={async()=>{await useLatest();confirm.close();}}>Use latest version</button><button class="secondary" onclick={()=>confirm.close()}>Keep my edits</button></dialog>

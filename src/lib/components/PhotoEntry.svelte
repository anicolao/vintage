<script lang="ts">
  import { goto } from '$app/navigation';
  import { style, workflows, enqueue, emptyWorkflow } from '$lib/state/pipeline';
  import PipelineStatus from './PipelineStatus.svelte';
  import { onMount, onDestroy, tick } from 'svelte';
  import { app, dispatch, retryDelivery, discardRejected } from '$lib/state/app';
  import { watchListing, eventFor } from '$lib/repositories/drafts';
  import { photoJobs, restorePhotos, addPhoto, retryPhoto, discardPhoto, type PhotoJob } from '$lib/state/photos';
  import type { Photo } from '$lib/events/contracts';
  import { reduceListing } from '$lib/events/listing.mjs';
  import PhotoTile from './PhotoTile.svelte';
  import AccountMenu from './AccountMenu.svelte';
  import Recovery from './Recovery.svelte';
  import Icon from './Icon.svelte';
  import Status from './Status.svelte';
  export let id: string;
  export let uid: string;
  let replaceDialog: HTMLDialogElement;
  async function generate(replace = false) {
    await saveContext();
    if (error || !usable) return;
    if ($style.status !== 'ready') { await goto(`/style?item=${encodeURIComponent(id)}`); return; }
    const workflow = $workflows[id] || emptyWorkflow();
    if (workflow.proposal && !replace) { replaceDialog.showModal(); return; }
    const ids = projection.photos.filter(p => !jobs.some(j => j.replace === p.id)).map(p => p.id);
    ids.push(...jobs.filter(j => !j.error).map(j => j.photo.id));
    try {
      await enqueue({ kind: 'generate', listingId: id, expectedVersion: workflow.version, photoIds: ids, context, styleVersion: $style.version, replace });
      await goto(`/listings/${id}`);
    } catch { error = 'Your request could not be saved on this phone. Try again.'; }
  }
  let events: unknown[] = []; let loaded = false; let error = '';
  let context = ''; let edited = false; let saving = false;
  let online = true;
  let fileInput: HTMLInputElement; let cameraInput: HTMLInputElement;
  let photoDialog: HTMLDialogElement;
  let editor: HTMLElement;
  let selected: Photo | null = null; let selectedUrl = '';
  let removed: { photo: Photo; position: number } | null = null;
  let undoing = false;
  let showOrder = false;
  let dragged: string | null = null;
  let replacing: string | null = null;
  let replacingJob: PhotoJob | null = null;
  $: jobs = $photoJobs.filter(j => j.photo.uid === uid && j.photo.listingId === id);
  $: commands = $app.commands.filter(c => c.streamId === id);
  $: projection = reduceListing([...events, ...commands.filter(c => !events.some(e => (e as { id: string }).id === c.id)).map(eventFor)], id, uid);
  $: pending = commands.length > 0;
  $: empty = projection.photos.length + jobs.length === 0;
  $: usable = projection.photos.length + jobs.filter(j => !j.error).length;
  $: if (!edited) context = commands.filter(c => c.type === 'context/changed').at(-1)?.payload.context ?? projection.context;
  $: selectedPosition = selected ? projection.photos.findIndex(p => p.id === selected?.id) : -1;
  $: sync = error || jobs.some(j => j.error) ? 'error' : saving || edited || pending || jobs.length ? 'pending' : 'synced';
  onMount(() => {
    const connection = () => { online = navigator.onLine; };
    connection(); window.addEventListener('online', connection); window.addEventListener('offline', connection);
    const stop = watchListing(uid, id, (next, confirmed) => { events = next; loaded = confirmed || next.length > 0; }, () => { loaded = true; error = 'Your item could not be opened. Try again.'; });
    void restorePhotos(uid, id).catch(() => error = 'Photos could not be restored from this device. Select them again.');
    return () => { stop(); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); };
  });
  onDestroy(() => { void saveContext(); });
  async function saveContext() {
    if (saving || !edited || $app.user?.uid !== uid) return;
    const value = context; saving = true; error = '';
    try { await dispatch({ type: 'context/changed', payload: { context: value } }, id); if (context === value) edited = false; }
    catch { error = 'Not saved on this phone. Your details could not be saved. Try again.'; }
    finally { saving = false; if (edited && !error) void saveContext(); }
  }
  function changed() { edited = true; void saveContext(); }
  async function addFiles(input: HTMLInputElement) {
    const files = [...(input.files ?? [])]; input.value = '';
    const replace = replacing; replacing = null;
    const oldJob = replacingJob; replacingJob = null;
    if (projection.photos.length + jobs.filter(j => !j.replace).length + files.length - (replace ? 1 : 0) - (oldJob && !oldJob.replace ? 1 : 0) > 8) { error = 'Use up to 8 photos per item.'; return; }
    for (const file of files) {
      try { await addPhoto(file, uid, id, replace); if (oldJob) await discardPhoto(oldJob); }
      catch { error = 'Not saved on this phone. Free some space and select the photo again.'; }
    }
  }
  function inspect(photo: Photo, url: string) { selected = photo; selectedUrl = url; showOrder = false; if (!photoDialog.open) photoDialog.showModal(); }
  async function remove() {
    if (!selected) return;
    const previous = { photo: selected, position: selectedPosition };
    try {
      await dispatch({ type: 'photo/removed', payload: { photoId: selected.id } }, id);
      removed = previous; photoDialog.close(); selected = null;
      await tick(); editor.querySelector<HTMLButtonElement>('.undo-notice button')?.focus();
    } catch { error = 'Photo could not be removed. Try again.'; }
  }
  async function undoRemove() {
    if (!removed || undoing) return;
    if (projection.photos.length + jobs.filter(j => !j.replace).length >= 8) { error = 'Remove a photo before restoring this one.'; return; }
    undoing = true;
    try {
      await dispatch({ type: 'photo/uploaded', payload: { photo: removed.photo } }, id);
      await tick(); await move(removed.photo.id, Math.min(removed.position, projection.photos.length - 1));
      removed = null;
    } catch { error = 'Photo could not be restored. Try again.'; }
    finally { undoing = false; }
  }
  async function move(photoId: string, target: number) {
    const ids = projection.photos.map(p => p.id); const from = ids.indexOf(photoId);
    if (from < 0 || target < 0 || target >= ids.length || from === target) return;
    ids.splice(from, 1); ids.splice(target, 0, photoId);
    try { await dispatch({ type: 'photo/reordered', payload: { photoIds: ids } }, id); } catch { error = 'Photo order could not be saved. Try again.'; }
  }
</script>

{#if loaded && projection.status !== 'draft' && !pending && !error}<Recovery listing />{:else}
<main bind:this={editor} class="photo-screen" data-e2e-layout data-status={loaded || projection.status === 'draft' ? 'ready' : 'connecting'} data-sync={sync}>
  <header class="step-header glass"><a class="icon-button" href="/" aria-label="Your listings"><Icon name="back" /></a><span>1 of 3 · Add photos</span><AccountMenu /></header>
  {#if projection.status === 'draft'}
    <section class="photo-intro glass"><h1>Show us the item</h1><p>{empty ? 'Start with the front. Add labels and any wear next.' : 'Add clear photos from every angle. Include labels and any wear.'}</p></section>
    {#if !online && !saving && !edited}<div class="sync-banner glass" role="status"><Icon name="cloud" /><div><strong>Saved on this phone</strong><span>{jobs.length ? "Photos will sync when you're connected." : "Changes will sync when you're connected."}</span></div></div>{/if}
    {#if empty}<section class="first-photo glass" aria-label="Add your first photo"><div class="capture-area"><Icon name="camera" size={56} /><button onclick={() => { replacing = null; cameraInput.click(); }}>Take photo</button><button class="secondary" onclick={() => { replacing = null; fileInput.click(); }}>Choose photos</button></div></section>
    {:else}<div class="photo-grid" aria-label="Item photos">
      {#each projection.photos as photo, index (photo.id)}
        <div role="group" aria-label={`Photo ${index + 1}`} draggable="true" ondragstart={() => dragged = photo.id} ondragover={event => event.preventDefault()} ondrop={event => { event.preventDefault(); if (dragged) void move(dragged, index); dragged = null; }}><PhotoTile {photo} position={index + 1} open={inspect} /></div>
      {/each}
      {#each jobs as job (job.photo.id)}<div class="upload-tile glass" role="group" aria-label="Photo upload">
        {#if !/hei[cf]/i.test(job.photo.file.type + job.photo.file.name) && job.photo.file.type.startsWith('image/')}<img class="upload-preview" src={job.url} alt="Selected item" />{:else}<Icon name="camera" size={32} />{/if}
        {#if job.error}<div class="upload-feedback"><p role="alert">Couldn't use this photo. {job.error}</p><button class="secondary" onclick={() => { replacing = job.replace; replacingJob = job; fileInput.click(); }}>Choose another photo</button>{#if job.retryable}<button class="secondary" onclick={() => retryPhoto(job)}>Try again</button>{/if}<button class="secondary" onclick={() => discardPhoto(job)}>Remove</button></div>
        {:else}<span class="upload-badge glass" role="status" aria-label={online ? 'Syncing photo' : 'Photo saved on this phone'}><Icon name="cloud" size={18} />{#if online}<span>Syncing</span>{/if}</span>{/if}
      </div>{/each}
      {#if projection.photos.length + jobs.filter(j => !j.replace).length < 8}<div class="add-tile glass"><button class="add-photo" onclick={() => { replacing = null; fileInput.click(); }}><span class="icon-disc"><Icon name="camera" size={28} /></span><span>Add photo</span></button><button class="camera-action" onclick={() => { replacing = null; cameraInput.click(); }}>Take photo</button></div>{/if}
    </div>{/if}
    <input class="file-input" tabindex="-1" bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple={!replacing} oncancel={() => { replacing = null; replacingJob = null; }} onchange={() => addFiles(fileInput)} aria-label="Choose item photos" />
    <input class="file-input" tabindex="-1" bind:this={cameraInput} type="file" accept="image/*" capture="environment" oncancel={() => { replacing = null; replacingJob = null; }} onchange={() => addFiles(cameraInput)} aria-label="Take item photo" />
    <section class="context-card glass"><label for="item-context">Anything else?</label><input id="item-context" bind:value={context} oninput={changed} onblur={saveContext} maxlength="2000" placeholder={empty ? 'Fit, provenance, or an unpictured detail' : 'e.g. Rare 1990s piece, fits oversized'} /></section>
    <button class="create-draft" disabled={!usable || $workflows[id]?.status === 'generating'} onclick={() => generate()}>Create my draft<Icon name="next"/></button>
    {#if !usable}<p class="quiet-status">Add a photo to continue</p>{/if}
    <PipelineStatus/>
    {#if removed}<div class="undo-notice glass" role="status"><span>Photo removed</span><button class="text-button" disabled={undoing} onclick={undoRemove}>Undo</button></div>{/if}
  {:else}<p role="status">Opening your item…</p>{/if}
  <Status message={error || (pending ? $app.error : '')} error />
  {#if pending && !$app.sending && $app.error}<button class="secondary" onclick={() => retryDelivery()}>Try again</button>{#if commands.some(c => c.status === 'rejected')}<button class="secondary" onclick={() => discardRejected(id)}>Discard unsaved change</button>{/if}{/if}
  {#if error}<button class="secondary" onclick={() => edited ? saveContext() : location.reload()}>Try again</button>{/if}
  {#if projection.diagnostics.length}<Status message="Some changes could not be displayed." error />{/if}
</main>{/if}
<dialog class="photo-inspection" bind:this={photoDialog} aria-label="Photo inspection">
  <header class="inspection-header glass"><button class="icon-button" onclick={() => photoDialog.close()} aria-label="Close photo"><Icon name="close" /></button><span aria-live="polite">Photo {selectedPosition + 1} of {projection.photos.length}</span><button class="icon-button" onclick={() => showOrder = !showOrder} aria-label="Photo order" aria-expanded={showOrder}><Icon name="more" /></button></header>
  {#if selected}
    <img class="inspected-photo" src={selectedUrl} alt={`Item photo ${selectedPosition + 1}`} />
    <nav class="filmstrip" aria-label="Select photo">{#each projection.photos as photo, index (photo.id)}<div class:selected-photo={selected.id === photo.id}><PhotoTile {photo} position={index + 1} open={inspect} /></div>{/each}</nav>
    <p class="cover-caption">{#if selectedPosition === 0}<Icon name="check" size={18} />Cover photo{:else}Photo {selectedPosition + 1}{/if}</p>
    {#if showOrder}<div class="order-actions glass"><button class="secondary" disabled={selectedPosition <= 0} onclick={() => selected && move(selected.id, selectedPosition - 1)}><Icon name="up" />Move earlier</button><button class="secondary" disabled={selectedPosition >= projection.photos.length - 1} onclick={() => selected && move(selected.id, selectedPosition + 1)}><Icon name="down" />Move later</button></div>{/if}
    <div class="photo-actions glass"><button disabled={selectedPosition === 0} onclick={() => selected && move(selected.id, 0)}><Icon name="star" />Make cover</button><button aria-label="Replace photo" onclick={() => { replacing = selected?.id ?? null; photoDialog.close(); fileInput.click(); }}><Icon name="replace" />Replace</button><button class="remove-action" aria-label="Remove photo" onclick={remove}><Icon name="trash" />Remove</button></div>
  {/if}
</dialog>

<dialog class="account-sheet glass" bind:this={replaceDialog} aria-labelledby="replace-title"><h2 id="replace-title">Replace proposal?</h2><p>A new sample proposal will replace your title, description, attributes and selected price. Your photos and context will stay saved.</p><button onclick={() => { replaceDialog.close(); void generate(true); }}>Replace proposal</button><button class="secondary" onclick={() => replaceDialog.close()}>Keep editing</button></dialog>

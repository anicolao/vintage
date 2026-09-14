<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { app, dispatch, retryDelivery, discardRejected } from '$lib/state/app';
  import { logout } from '$lib/auth/session';
  import { watchListing, eventFor } from '$lib/repositories/drafts';
  import { photoJobs, restorePhotos, addPhoto, retryPhoto, discardPhoto } from '$lib/state/photos';
  import type { Photo } from '$lib/events/contracts';
  import { reduceListing } from '$lib/events/listing.mjs';
  import PhotoTile from './PhotoTile.svelte';
  import Icon from './Icon.svelte';
  import Status from './Status.svelte';
  export let id: string;
  export let uid: string;
  let events: unknown[] = []; let loaded = false; let error = '';
  let context = ''; let edited = false; let saving = false; let active = true;
  let fileInput: HTMLInputElement; let cameraInput: HTMLInputElement;
  let accountDialog: HTMLDialogElement; let photoDialog: HTMLDialogElement;
  let selected: Photo | null = null; let selectedUrl = '';
  $: jobs = $photoJobs.filter(j => j.photo.uid === uid && j.photo.listingId === id);
  let dragged: string | null = null;
  let replacing: string | null = null;
  $: projection = reduceListing([...events, ...commands.filter(c => !events.some(e => (e as { id: string }).id === c.id)).map(eventFor)], id, uid);
  $: commands = $app.commands.filter(c => c.streamId === id);
  $: pending = commands.length > 0;
  $: uploading = jobs.some(j => j.running);
  $: if (!edited) context = commands.filter(c => c.type === 'context/changed').at(-1)?.payload.context ?? projection.context;
  $: selectedPosition = selected ? projection.photos.findIndex(p => p.id === selected?.id) : -1;
  onMount(() => {
    const stop = watchListing(uid, id, next => { events = next; loaded = true; }, () => { loaded = true; error = 'Your item could not be opened. Try again.'; });
    void restorePhotos(uid, id).catch(() => error = 'Photos could not be restored from this device. Select them again.');
    return stop;
  });
  onDestroy(() => { void saveContext(); active = false; });
  async function saveContext() {
    if (saving || !edited || $app.user?.uid !== uid) return;
    const value = context; saving = true; error = '';
    try { await dispatch({ type: 'context/changed', payload: { context: value } }, id); if (context === value) edited = false; }
    catch { error = 'Your details could not be saved. Try again.'; }
    finally { saving = false; if (edited && !error) void saveContext(); }
  }
  function changed() { edited = true; void saveContext(); }
  async function addFiles(input: HTMLInputElement) {
    const files = [...(input.files ?? [])]; input.value = '';
    const replace = replacing; replacing = null;
    if (projection.photos.length + jobs.length + files.length - (replace ? 1 : 0) > 8) { error = 'Use up to 8 photos per item.'; return; }
    for (const file of files) {
      try { await addPhoto(file, uid, id, replace); }
      catch { error = 'This photo could not be saved on your device. Free some space and try again.'; }
    }
  }
  function inspect(photo: Photo, url: string) { selected = photo; selectedUrl = url; photoDialog.showModal(); }
  async function remove() {
    if (!selected) return;
    await dispatch({ type: 'photo/removed', payload: { photoId: selected.id } }, id);
    photoDialog.close(); selected = null;
  }
  async function move(photoId: string, target: number) {
    const ids = projection.photos.map(p => p.id); const from = ids.indexOf(photoId);
    if (from < 0 || target < 0 || target >= ids.length || from === target) return;
    ids.splice(from, 1); ids.splice(target, 0, photoId);
    try { await dispatch({ type: 'photo/reordered', payload: { photoIds: ids } }, id); } catch { error = 'Photo order could not be saved. Try again.'; }
  }
</script>

<main class="photo-screen" data-e2e-layout data-status={loaded ? 'ready' : 'connecting'}>
  <header class="step-header glass">
    <a class="icon-button" href="/" aria-label="Your listings"><Icon name="back" /></a>
    <span>1 of 3 · Add photos</span>
    <button class="avatar" onclick={() => accountDialog.showModal()} aria-label="Your account">{#if $app.user?.photoURL}<img src={$app.user.photoURL} alt="" referrerpolicy="no-referrer" />{:else}<span>{$app.user?.displayName?.slice(0, 1) || 'V'}</span>{/if}</button>
  </header>
  {#if projection.status === 'draft'}
    <section class="photo-intro glass"><h1>Show us the item</h1><p>Add clear photos from every angle. Include labels and any wear.</p></section>
    <div class="photo-grid" aria-label="Item photos">
      {#each projection.photos as photo, index (photo.id)}
        <div role="group" aria-label={`Photo ${index + 1}`} draggable="true" ondragstart={() => dragged = photo.id} ondragover={event => event.preventDefault()} ondrop={event => { event.preventDefault(); if (dragged) void move(dragged, index); dragged = null; }}>
          <PhotoTile {photo} position={index + 1} open={inspect} />
        </div>
      {/each}
      {#each jobs as job (job.photo.id)}<div class="upload-tile glass" role="group" aria-label="Photo upload">
        {#if !/hei[cf]/i.test(job.photo.file.type + job.photo.file.name) && job.photo.file.type.startsWith('image/')}<img class="upload-preview" src={job.url} alt="Selected item" />{:else}<Icon name="camera" size={32} />{/if}
        <div class="upload-feedback">{#if job.error}<p role="alert">{job.error}</p><button onclick={() => retryPhoto(job)}>Try again</button><button class="secondary" onclick={() => discardPhoto(job)}>Remove</button>{:else}<p role="status">{job.running ? `Uploading ${job.progress}%` : 'Waiting to upload'}</p><progress max="100" value={job.progress}></progress>{/if}</div>
      </div>{/each}
      {#if projection.photos.length + jobs.length < 8}<div class="add-tile glass"><button class="add-photo" onclick={() => { replacing = null; fileInput.click(); }}><span class="icon-disc"><Icon name="camera" size={28} /></span><span>Add photo</span></button><button class="camera-action" onclick={() => { replacing = null; cameraInput.click(); }}>Use camera</button></div>{/if}
    </div>
    <input class="file-input" bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple={!replacing} onchange={() => addFiles(fileInput)} aria-label="Choose item photos" />
    <input class="file-input" bind:this={cameraInput} type="file" accept="image/*" capture="environment" onchange={() => addFiles(cameraInput)} aria-label="Take item photo" />
    <section class="context-card glass"><label for="item-context">Anything else?</label><input id="item-context" bind:value={context} oninput={changed} onblur={saveContext} maxlength="2000" placeholder="e.g. Rare 1990s piece, fits oversized" /></section>
    <Status message={uploading ? 'Uploading photos…' : jobs.length ? 'Some photos need attention.' : saving || edited || pending ? 'Saving…' : 'Saved'} />
  {:else if loaded && !pending}<section class="photo-intro glass"><h1>Item unavailable</h1><p>This item isn’t available in this account.</p><a class="button" href="/listings/new">Add item</a></section>
  {:else}<p role="status">Opening your item…</p>{/if}
  <Status message={error || (pending ? $app.error : '')} error />
  {#if pending && !$app.sending}<button onclick={() => retryDelivery()}>Try again</button>{#if commands.some(c => c.status === 'rejected')}<button class="secondary" onclick={() => discardRejected(id)}>Discard unsaved change</button>{/if}{/if}
  {#if error}<button onclick={() => edited ? saveContext() : location.reload()}>Try again</button>{/if}
  {#if projection.diagnostics.length}<Status message="Some changes could not be displayed." error />{/if}
</main>
<dialog class="account-sheet glass" bind:this={accountDialog}>
  <button class="icon-button close-dialog" onclick={() => accountDialog.close()} aria-label="Close account"><Icon name="close" /></button>
  <h2>Your account</h2><p>{$app.user?.displayName}</p>
  <button class="secondary" onclick={async () => { accountDialog.close(); await logout(); }}>Sign out</button>
</dialog>
<dialog class="photo-inspection" bind:this={photoDialog}>
  <button class="icon-button close-dialog" onclick={() => photoDialog.close()} aria-label="Close photo"><Icon name="close" /></button>
  {#if selected}<img class="inspected-photo" src={selectedUrl} alt={`Item photo ${selectedPosition + 1}`} /><p>Photo {selectedPosition + 1} of {projection.photos.length}</p>
    <div class="photo-actions"><button disabled={selectedPosition <= 0} onclick={() => selected && move(selected.id, selectedPosition - 1)}><Icon name="up" />Move earlier</button><button disabled={selectedPosition >= projection.photos.length - 1} onclick={() => selected && move(selected.id, selectedPosition + 1)}><Icon name="down" />Move later</button><button onclick={() => { replacing = selected?.id ?? null; photoDialog.close(); fileInput.click(); }}>Replace photo</button><button onclick={remove}>Remove photo</button></div>
  {/if}
</dialog>

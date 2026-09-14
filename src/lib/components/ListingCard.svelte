<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { watchWorkflow, workflows } from '$lib/state/pipeline';
  import { app } from '$lib/state/app';
  import { photoJobs, restorePhotos } from '$lib/state/photos';
  import { watchListing, eventFor } from '$lib/repositories/drafts';
  import { photoUrl } from '$lib/repositories/photos';
  import { reduceListing } from '$lib/events/listing.mjs';
  import type { Photo } from '$lib/events/contracts';
  import Icon from './Icon.svelte';
  export let id: string;
  export let uid: string;
  export let updatedAt: number | undefined = undefined;
  let events: unknown[] = [];
  let coverUrl = ''; let active = true; let request = 0;
  let failed = false;
  $: commands = $app.commands.filter(c => c.streamId === id);
  $: projection = reduceListing([...events, ...commands.filter(c => !events.some(e => (e as {id: string}).id === c.id)).map(eventFor)], id, uid);
  $: jobs = $photoJobs.filter(j => j.photo.uid === uid && j.photo.listingId === id);
  $: cover = projection.photos[0];
  $: loadCover(cover);
  $: count = projection.photos.length + jobs.filter(j => !j.replace).length;
  // The creation event is an internal placeholder, never an inferred item name.
  $: workflow = $workflows[id];
  $: editedAt = workflow?.updatedAt ? Date.parse(workflow.updatedAt)/1000 : updatedAt;
  $: stage = ({generating:'Creating draft',reviewing:'Ready to review','approval-pending':'Approval pending',approved:'Approved',failed:'Draft needs attention'} as Record<string,string>)[workflow?.status] || 'Draft';
  $: title = workflow?.approved?.copy.title || workflow?.copy?.title || (['Item', 'Untitled item', ''].includes(projection.title) ? 'Untitled item' : projection.title);
  onMount(() => {
    void restorePhotos(uid, id).catch(() => failed = true);
    const stopWorkflow = watchWorkflow(uid, id);
    const stopListing = watchListing(uid, id, next => { events = next; failed = false; }, () => failed = true);
    return () => { stopWorkflow(); stopListing(); };
  });
  onDestroy(() => { active = false; request++; URL.revokeObjectURL(coverUrl); });
  async function loadCover(photo: Photo | undefined) {
    const current = ++request;
    URL.revokeObjectURL(coverUrl); coverUrl = '';
    if (!photo) return;
    try { const url = await photoUrl(photo); if (active && current === request) coverUrl = url; else URL.revokeObjectURL(url); } catch { /* The item remains openable if its cover cannot load. */ }
  }
</script>
<a class="glass listing-row" href={`/listings/${id}`}>
  <div class="listing-cover">
    {#if coverUrl}<img src={coverUrl} alt="" />{:else if jobs[0]?.photo.file.type.startsWith('image/') && !/hei[cf]/i.test(jobs[0].photo.file.type)}<img src={jobs[0].url} alt="" />{:else}<Icon name="camera" size={32} />{/if}
  </div>
  <div class="listing-summary"><h2>{title}</h2><span class="stage-chip"><span aria-hidden="true">●</span> {stage} · {count} {count === 1 ? 'photo' : 'photos'}</span>
    {#if commands.length || jobs.length}<span class="listing-date">Saved on this phone</span>{:else if failed}<span class="listing-date">Open to retry</span>{:else if editedAt}<time class="listing-date" datetime={new Date(editedAt * 1000).toISOString()}>{new Date(editedAt * 1000).toDateString() === new Date().toDateString() ? 'Today' : new Date(editedAt * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time>{/if}
  </div>
  <Icon name="next" size={18} />
</a>

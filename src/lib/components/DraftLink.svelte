<script lang="ts">
  import { onMount } from 'svelte';
  import { watchListing } from '$lib/repositories/drafts';
  import { reduceListing } from '$lib/events/listing.mjs';
  export let id: string;
  export let uid: string;
  let title = 'Opening draft…';
  onMount(() => watchListing(uid, id, events => { title = reduceListing(events, id, uid).title || 'Untitled draft'; }, () => { title = 'Draft unavailable'; }));
</script>
<a class="glass draft-link" href={`/listings/${id}`}><span>{title}</span><span class="chip">Resume draft →</span></a>

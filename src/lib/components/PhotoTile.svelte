<script lang="ts">
  import { onMount } from 'svelte';
  import type { Photo } from '$lib/events/contracts';
  import { photoUrl } from '$lib/repositories/photos';
  import Icon from './Icon.svelte';
  export let photo: Photo;
  export let position: number;
  export let open: (photo: Photo, url: string) => void;
  let url = ''; let error = '';
  async function load() { error = ''; try { url = await photoUrl(photo); } catch { error = 'Photo could not load'; } }
  onMount(() => { let active = true; void photoUrl(photo).then(next => { if (active) url = next; else URL.revokeObjectURL(next); }).catch(() => error = 'Photo could not load'); return () => { active = false; URL.revokeObjectURL(url); }; });
</script>
{#if error}<button class="photo-tile glass" onclick={load}>{error}. Try again</button>
{:else}<button class="photo-tile glass" onclick={() => open(photo, url)} disabled={!url} aria-label={`Inspect photo ${position}`}>
  {#if url}<img src={url} alt={`Item photo ${position}`} />{:else}<span>Loading photo…</span>{/if}
  <span class="photo-number">{position}</span>
</button>{/if}

<script lang="ts">
  import '@fontsource-variable/inter';
  import '@fontsource/dm-serif-display/400.css';
  import '$lib/styles.css';
  import { preloadCode } from '$app/navigation';
  import { startPipeline } from '$lib/state/pipeline';
  import { onMount } from 'svelte';
  import { startSession } from '$lib/state/app';
  import { resumePhotoUploads } from '$lib/state/photos';
  onMount(() => {
    // Load navigation modules while connected so Save draft can return home
    // offline, including when this session began at a listing deep link.
    const prepareNavigation = () => { void preloadCode('/').catch(() => {}); void preloadCode('/listings/*').catch(() => {}); };
    prepareNavigation();
    window.addEventListener('online', prepareNavigation);
    const stopPipeline = startPipeline();
    const stop = startSession();
    window.addEventListener('online', resumePhotoUploads);
    return () => { window.removeEventListener('online', prepareNavigation); stopPipeline(); stop(); window.removeEventListener('online', resumePhotoUploads); };
  });
</script>
<div class="app-shell"><slot /></div>

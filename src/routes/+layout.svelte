<script lang="ts">
  import '@fontsource-variable/inter';
  import '@fontsource/dm-serif-display/400.css';
  import '$lib/styles.css';
  import { startPipeline } from '$lib/state/pipeline';
  import { onMount } from 'svelte';
  import { startSession } from '$lib/state/app';
  import { resumePhotoUploads } from '$lib/state/photos';
  onMount(() => {
    const stopPipeline = startPipeline();
    const stop = startSession();
    window.addEventListener('online', resumePhotoUploads);
    return () => { stopPipeline(); stop(); window.removeEventListener('online', resumePhotoUploads); };
  });
</script>
<div class="app-shell"><slot /></div>

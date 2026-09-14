<script lang="ts">
  import '@fontsource-variable/inter';
  import '@fontsource/dm-serif-display/400.css';
  import '$lib/styles.css';
  import { onMount } from 'svelte';
  import { startSession } from '$lib/state/app';
  import { resumePhotoUploads } from '$lib/state/photos';
  onMount(() => {
    const stop = startSession();
    window.addEventListener('online', resumePhotoUploads);
    return () => { stop(); window.removeEventListener('online', resumePhotoUploads); };
  });
</script>
<div class="app-shell"><slot /></div>

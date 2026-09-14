<script lang="ts">
  import '@fontsource-variable/inter';
  import '@fontsource/dm-serif-display/400.css';
  import '$lib/styles.css';
  import { onMount } from 'svelte';
  import { startSession } from '$lib/state/app';
  onMount(startSession);
</script>
<div class="app-shell"><slot /></div>

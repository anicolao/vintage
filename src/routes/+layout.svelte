<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/400.css';
  import '@fontsource/atkinson-hyperlegible/700.css';
  import '$lib/styles.css';
  import { onMount } from 'svelte';
  import { startSession } from '$lib/state/app';
  onMount(startSession);
</script>
<div class="app-shell"><slot /></div>

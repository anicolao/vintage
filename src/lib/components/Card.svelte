<script lang="ts">
  import type { Snippet } from 'svelte';
  export let children: Snippet;
</script>
<section class="glass card">{@render children()}</section>

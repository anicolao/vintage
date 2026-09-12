<script lang="ts">
  import type { Snippet } from 'svelte';
  export let children: Snippet;
  export let onclick: (() => void) | undefined = undefined;
  export let disabled = false;
  export let secondary = false;
  export let type: 'button' | 'submit' = 'button';
</script>
<button {type} {onclick} {disabled} class:secondary>{@render children()}</button>

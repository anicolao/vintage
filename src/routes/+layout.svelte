<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/400.css';
  import '@fontsource/atkinson-hyperlegible/700.css';
  import '$lib/styles.css';
  import { onMount } from 'svelte';
  import { app, startSession } from '$lib/state/app';
  import { logout, explain } from '$lib/auth/session';
  import Status from '$lib/components/Status.svelte';
  let error = '';
  onMount(startSession);
  async function signOut() { try { await logout(); } catch (cause) { error = explain(cause); } }
</script>
<div class="app-shell">
  <header class="site-header"><a class="wordmark" href="/" aria-label="Vintage home">Vintage<span aria-hidden="true">✦</span></a>
    {#if $app.user}<button class="secondary compact" onclick={signOut}>Sign out</button>{:else}<span class="chip">Made for your next chapter</span>{/if}
  </header>
  <Status message={error} error />
  <slot />
  <footer><span>Your drafts stay yours until you approve them.</span><a href="/connection-check">Connection checks</a></footer>
</div>

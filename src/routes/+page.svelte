<script lang="ts">
  import { app } from '$lib/state/app';
  import { logout } from '$lib/auth/session';
  import SignInScreen from '$lib/components/SignInScreen.svelte';
  import Status from '$lib/components/Status.svelte';
  $: ids = [...new Set([...$app.commands.filter(c => c.type === 'listing/created').map(c => c.streamId), ...$app.drafts.map(d => d.id)])];
</script>
<svelte:head><title>{$app.user ? 'Your listings — Vintage' : 'Vintage — List smarter. Earn more.'}</title></svelte:head>
{#if !$app.user}<SignInScreen />{:else}
<main class="photo-screen" data-e2e-layout data-status="ready">
  <header class="step-header glass"><h1>Your listings</h1><button class="secondary" onclick={logout}>Sign out</button></header>
  <a class="button new-listing" href="/listings/new">New listing</a>
  <nav class="listing-list" aria-label="Your listings">{#each ids as id, i (id)}<a class="glass listing-row" href={`/listings/${id}`}>Listing {ids.length - i}<span aria-hidden="true">→</span></a>{/each}</nav>
  <Status message={$app.error} error />
</main>{/if}

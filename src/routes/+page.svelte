<script lang="ts">
  import { pipelineIntents } from '$lib/state/pipeline';
  import { app } from '$lib/state/app';
  import AccountMenu from '$lib/components/AccountMenu.svelte';
  import ListingCard from '$lib/components/ListingCard.svelte';
  import SignInScreen from '$lib/components/SignInScreen.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PipelineStatus from '$lib/components/PipelineStatus.svelte';
  import Status from '$lib/components/Status.svelte';
  $: ids = [...new Set([...$pipelineIntents.filter(i=>i.request.kind==='duplicate').map(i=>i.request.listingId),...$app.commands.filter(c => c.type === 'listing/created').map(c => c.streamId), ...$app.drafts.map(d => d.id)])];
</script>
<svelte:head><title>{$app.user ? 'Your listings — Vintage' : 'Vintage — List smarter. Earn more.'}</title></svelte:head>
{#if !$app.resolved}<main class="loading-screen"><p role="status">Restoring your account…</p></main>
{:else if !$app.user}<SignInScreen />{:else}
<main class="listings-screen" data-e2e-layout data-status="ready">
  <header class="home-header"><a class="small-wordmark" href="/" aria-label="Vintage home">Vintage</a><AccountMenu /></header>
  <h1>Your listings</h1>
  {#if ids.length}<nav class="listing-list" aria-label="Your listings">{#each ids as id (`${$app.user.uid}/${id}`)}<ListingCard {id} uid={$app.user.uid} updatedAt={$app.drafts.find(d => d.id === id)?.updatedAt?.seconds} />{/each}</nav>
  {:else if !$app.listingsLoaded}<div class="listing-skeleton glass" role="status">Opening your listings…</div>
  {:else}<section class="empty-listings glass"><div class="empty-photo-stack" aria-hidden="true"><span></span><span></span><div class="camera-orb"><Icon name="camera" size={44} /></div></div><h2>Your first listing</h2><p>Start with a photo.<br />Add the details as you go.</p></section>{/if}
  <PipelineStatus/>
  <Status message={$app.error} error />
  {#if $app.error}<button class="secondary" onclick={() => location.reload()}>Try again</button>{/if}
  <footer class="listings-footer">{#if ids.length}<p>Start with a photo.</p>{/if}<a class="button new-listing" href="/listings/new"><Icon name="plus" />New listing</a></footer>
</main>{/if}

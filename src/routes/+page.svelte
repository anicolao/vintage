<script lang="ts">
  import { app } from '$lib/state/app';
  import Card from '$lib/components/Card.svelte';
  import DraftLink from '$lib/components/DraftLink.svelte';
  import SignIn from '$lib/components/SignIn.svelte';
  import AccountGate from '$lib/components/AccountGate.svelte';
  $: unsaved = $app.commands.filter((c, i, all) => c.type !== 'account/created' && all.findIndex(other => other.streamId === c.streamId) === i);
  const ownerKey = (id: string) => `${$app.user?.uid}/${id}`;
</script>
<svelte:head><title>Vintage — List smarter. Earn more.</title><meta name="description" content="Turn item photos into a listing written like you, with pricing built for value." /></svelte:head>
<main class="home" data-e2e-layout data-status={$app.resolved && (!$app.user || $app.ready) ? 'ready' : 'connecting'}>
{#if !$app.resolved}<p role="status">Restoring your account…</p>
{:else if !$app.user}
  <section class="pitch"><p class="eyebrow">A little help. A better listing.</p><h1>List smarter.<br />Earn more.</h1><p class="lede">Turn a few photos into a listing written like you, with pricing built for value.</p></section>
  <Card><p class="eyebrow">Less effort, more you</p><h2>Your next great listing starts here.</h2><p>Bring the pieces you’re ready to pass on. We’ll help you tell their story.</p><SignIn /><p class="fine-print">Sign in securely with your Google account.</p></Card>
  <section class="learn"><h2>What Vintage learns</h2><ul><li><span aria-hidden="true">♡</span>Your listing style</li><li><span aria-hidden="true">◎</span>How you describe condition</li><li><span aria-hidden="true">◇</span>Your pricing approach</li></ul></section>
  <p class="readiness" role="status">Ready</p>
{:else}
  <AccountGate><section class="pitch"><p class="eyebrow">A little space for what’s next</p><h1>Your drafts</h1><p class="lede">Pick up where you left off, or start with something new.</p></section>
    <Card><span class="chip">Just the beginning</span><h2>Give your next listing a home.</h2><p>Start with a name and a few details. Your draft will be here when you return.</p><a class="button" href="/listings/new">Start a new draft</a></Card>
    {#if unsaved.length}<section aria-label="Unsaved changes" class="draft-list"><h2>Waiting to save</h2><p class="fine-print">These changes are on this device. Open a draft to check delivery or retry.</p>{#each unsaved as command (command.id)}<a class="glass draft-link" href={`/listings/${command.streamId}`}><span>{command.payload.title || 'Unsaved draft changes'}</span><span class="chip">Open draft →</span></a>{/each}</section>{/if}
    {#if $app.drafts.length}<section aria-label="Saved drafts" class="draft-list">{#each $app.drafts as draft (ownerKey(draft.id))}<DraftLink id={draft.id} uid={$app.user.uid} />{/each}</section>{/if}
  </AccountGate>
{/if}
</main>

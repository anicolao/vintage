<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { app, dispatch, retryDelivery, discardRejected } from '$lib/state/app';
  import { watchListing } from '$lib/repositories/drafts';
  import { reduceListing } from '$lib/events/listing.mjs';
  import AccountGate from '$lib/components/AccountGate.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Status from '$lib/components/Status.svelte';
  let title = ''; let context = ''; let edited = false; let saving = false; let error = ''; let loaded = false;
  let events: unknown[] = []; let subscriptionKey = ''; let unsubscribe = () => {};
  $: id = $page.params.id ?? '';
  $: isNew = id === 'new';
  $: owner = $app.user?.uid ?? '';
  $: key = $app.ready && owner ? `${owner}/${id}` : '';
  $: if (key !== subscriptionKey) {
    unsubscribe(); subscriptionKey = key; events = []; context = ''; edited = false; error = ''; loaded = false; title = '';
    if (key && !isNew && /^[A-Za-z0-9_-]{1,256}$/.test(id)) {
      const subscribed = key;
      unsubscribe = watchListing(owner, id, next => { if (subscribed === subscriptionKey) { events = next; loaded = true; } }, () => { if (subscribed === subscriptionKey) { error = 'This draft could not be opened. Check your connection and retry.'; loaded = true; } });
    } else if (key) loaded = true;
  }
  $: projection = reduceListing(events, id, owner);

  $: commands = $app.commands.filter(c => c.streamId === id || (isNew && c.type === 'listing/created'));
  $: pending = commands.length > 0;
  $: if (!edited) context = commands.filter(c => c.type === 'context/changed').at(-1)?.payload.context ?? projection.context;
  onDestroy(() => { subscriptionKey = ''; unsubscribe(); });
  async function create() {
    if (saving || !title.trim()) return;
    saving = true; error = '';
    try { const nextId = await dispatch({ type: 'listing/created', payload: { title: title.trim() } }); await goto(`/listings/${nextId}`); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Could not start a draft. Please retry.'; }
    finally { saving = false; }
  }
  async function save() {
    if (saving || pending) return;
    saving = true; error = '';
    try { await dispatch({ type: 'context/changed', payload: { context } }, id); edited = false; }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Could not save your details. Please retry.'; }
    finally { saving = false; }
  }
</script>
<svelte:head><title>{isNew ? 'New draft' : 'Your draft'} — Vintage</title></svelte:head>
<main class="draft-page" data-e2e-layout data-status={$app.ready && (loaded || isNew) ? 'ready' : 'connecting'}>
  <a class="back-link" href="/">← Your drafts</a>
  <AccountGate>
    {#if isNew}<section class="pitch"><p class="eyebrow">Room for a new story</p><h1>What are you passing on?</h1><p class="lede">Give your draft a name. You can add the details next.</p></section>
      <Card><form onsubmit={e => { e.preventDefault(); void create(); }}><label for="draft-title">Draft name</label><input id="draft-title" bind:value={title} maxlength="100" required placeholder="e.g. My favourite linen jacket" /><Button type="submit" disabled={saving || !title.trim()}>Create draft</Button></form></Card>
    {:else if projection.status === 'draft'}
      <section class="pitch"><span class="chip">Draft · Just for you</span><h1>{projection.title}</h1><p class="lede">A place for the details that make this piece yours.</p></section>
      <Card><form onsubmit={e => { e.preventDefault(); void save(); }}><label for="draft-context">What should we know?</label><p id="context-help">Add any details you want to remember: fit, condition, or a little history.</p><textarea id="draft-context" aria-describedby="context-help" bind:value={context} oninput={() => edited = true} maxlength="2000" disabled={saving || pending} placeholder="A lovely relaxed fit, worn just a handful of times…"></textarea><Button type="submit" disabled={saving || pending || context === projection.context}>Save details</Button></form>
        <Status message={pending ? 'Waiting to save to the cloud…' : 'Saved to your account'} />
        <p class="fine-print">Photos and listing generation are coming next. For now, your draft and details are safely kept here.</p>
      </Card>
    {:else if pending}<Card><h1>Saving your new draft…</h1><p>Your draft is stored on this device while we connect to your account.</p></Card>
    {:else if loaded}<Card><h1>Draft unavailable</h1><p>This draft isn’t available in this account.</p><a class="button" href="/listings/new">Start a new draft</a></Card>
    {:else}<p role="status">Opening your draft…</p>{/if}
    <Status message={error || (pending ? $app.error : '')} error />
    {#if pending && !$app.sending}<Button onclick={() => retryDelivery()}>Retry saving</Button>
      {#if commands.some(c => c.status === 'rejected')}<Button secondary onclick={() => discardRejected(id)}>Discard unsaved change</Button><p class="fine-print">Discarding removes this device’s unsaved change. Saved cloud history is kept.</p>{/if}
    {/if}
    {#if error && !pending}<Button onclick={() => location.reload()}>Retry connection</Button>{/if}
    {#if projection.diagnostics.length}<Status message="Some saved changes could not be displayed. Your original draft history is preserved." error />{/if}
  </AccountGate>
</main>

<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { app, dispatch } from '$lib/state/app';
  import AccountGate from '$lib/components/AccountGate.svelte';
  import PhotoEntry from '$lib/components/PhotoEntry.svelte';
  let creating = false; let error = '';
  $: id = $page.params.id ?? '';
  $: if ($app.ready && id === 'new' && !creating) void create();
  async function create() {
    creating = true;
    try { const next = await dispatch({ type: 'listing/created', payload: { title: 'Item' } }); await goto(`/listings/${next}`, { replaceState: true }); }
    catch { error = 'Your item could not be opened. Try again.'; }
    finally { if (id !== 'new') creating = false; }
  }
</script>
<svelte:head><title>Add photos — Vintage</title></svelte:head>
<AccountGate>{#if id === 'new'}<main class="loading-screen"><p role="status">Opening your item…</p>{#if error}<p role="alert">{error}</p><button onclick={create}>Try again</button>{/if}</main>{:else}{#key `${$app.user?.uid}/${id}`}<PhotoEntry {id} uid={$app.user?.uid ?? ''} />{/key}{/if}</AccountGate>

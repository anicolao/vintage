<script lang="ts">
  import type { Snippet } from 'svelte';
  import { app } from '$lib/state/app';
  import SignIn from './SignIn.svelte';
  import Status from './Status.svelte';
  export let children: Snippet;
</script>
{#if !$app.resolved}<p role="status">Restoring your account…</p>
{:else if !$app.user}<h1>Your drafts stay yours.</h1><p>Sign in to open your saved listings.</p><SignIn />
{:else if !$app.ready}<p role="status">Opening your drafts…</p><Status message={$app.error} error />{#if $app.error}<button onclick={() => location.reload()}>Retry connection</button>{/if}
{:else}{@render children()}{/if}

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { app } from '$lib/state/app';
  import SignInScreen from './SignInScreen.svelte';
  import Status from './Status.svelte';
  export let children: Snippet;
</script>
{#if !$app.resolved}<main class="loading-screen"><p role="status">Restoring your account…</p></main>
{:else if !$app.user}<SignInScreen />
{:else if !$app.ready}<main class="loading-screen"><p role="status">Opening your item…</p><Status message={$app.error} error />{#if $app.error}<button onclick={() => location.reload()}>Try again</button>{/if}</main>
{:else}{@render children()}{/if}

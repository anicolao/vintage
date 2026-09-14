<script lang="ts">
  import { app } from '$lib/state/app';
  import { logout } from '$lib/auth/session';
  import Icon from './Icon.svelte';
  import AccountMenu from './AccountMenu.svelte';
  export let listing = false;
  let error = '';
  async function switchAccount() { try { await logout(); } catch { error = 'Could not switch account. Try again.'; } }
</script>
<main class="recovery-screen" data-e2e-layout data-status="ready">
  <header class="home-header"><a class="icon-button" href="/" aria-label="Your listings"><Icon name="back" /></a><a class="small-wordmark" href="/" aria-label="Vintage home">Vintage</a>{#if $app.user}<AccountMenu />{/if}</header>
  <section class="recovery-card glass"><span class="recovery-icon"><Icon name="photos" size={48} /></span><h1>{listing ? 'Listing unavailable' : 'Page unavailable'}</h1><p>{listing ? 'This link may be out of date, or this listing belongs to another account.' : 'This link may be out of date.'}</p><a class="button" href="/">{$app.user ? 'Your listings' : 'Sign in'}</a>{#if listing && $app.user}<button class="text-button" onclick={switchAccount}>Switch account</button>{/if}
    {#if error}<p role="alert">{error}</p>{/if}
  </section>
  {#if $app.user}<p class="recovery-footer">Your other listings are safe.</p>{/if}
</main>

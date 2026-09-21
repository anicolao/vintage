<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { pipelineSaving, pipelineIntents } from '$lib/state/pipeline';
  import { app } from '$lib/state/app';
  import { photoJobs } from '$lib/state/photos';
  import { logout } from '$lib/auth/session';
  import Icon from './Icon.svelte';
  let dialog: HTMLDialogElement;
  let confirming = false;
  let error = '';
  $: localWork = $app.commands.some(c => c.type !== 'account/created') || $photoJobs.some(j => j.photo.uid === $app.user?.uid) || $pipelineIntents.length > 0 || $pipelineSaving > 0;
  onMount(() => { if ($page.url.searchParams.get('account') === 'open') dialog.showModal(); });
  function open() { confirming = false; error = ''; dialog.showModal(); }
  async function signOut() {
    if (localWork && !confirming) { confirming = true; return; }
    try { await logout(); dialog.close(); }
    catch { error = 'Could not sign out. Try again.'; }
  }
</script>
<button class="avatar" onclick={open} aria-label="Your account">
  {#if $app.user?.photoURL}<img src={$app.user.photoURL} alt="" referrerpolicy="no-referrer" />{:else}<span>{$app.user?.displayName?.slice(0, 1) || 'V'}</span>{/if}
</button>
<dialog class="account-sheet glass" bind:this={dialog} aria-labelledby="account-title">
  <div class="sheet-handle" aria-hidden="true"></div>
  <header class="sheet-header"><h2 id="account-title">Your account</h2><button class="icon-button secondary" onclick={() => dialog.close()} aria-label="Close account"><Icon name="close" /></button></header>
  <div class="account-identity">
    <div class="avatar account-avatar">{#if $app.user?.photoURL}<img src={$app.user.photoURL} alt="" referrerpolicy="no-referrer" />{:else}<span>{$app.user?.displayName?.slice(0, 1) || 'V'}</span>{/if}</div>
    <div><p class="account-name">{$app.user?.displayName || 'Your account'}</p><p class="account-email">{$app.user?.email || ''}</p></div>
  </div>
  <p class="account-privacy"><Icon name="lock" size={20} /><span>Your photos and drafts are private to your account.</span></p>
  {#if confirming}<div class="signout-warning" role="status"><p>Some changes are saved only on this device. They will stay here for this account, but cannot be opened elsewhere until they sync.</p><button class="secondary" onclick={() => confirming = false}>Keep working</button></div>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  <button class="secondary signout-button" onclick={signOut}><Icon name="logout" />Sign out</button>
</dialog>

<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/400.css';
  import '@fontsource/atkinson-hyperlegible/700.css';
  import { onMount } from 'svelte';
  import type { User } from 'firebase/auth';
  import { login, logout, observeUser, settings } from '$lib/firebase';
  import { loadWorkspace, saveNote, verifyStorage } from '$lib/repositories/workspace';

  let status: 'connecting' | 'ready' | 'error' = 'connecting';
  let user: User | null = null;
  let note = '';
  let busy = false;
  let message = '';
  let error = '';
  let session = 0;

  function explain(cause: unknown) {
    const code = (cause as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled. Try again when you’re ready.';
    if (code === 'auth/popup-blocked') return 'Allow popups for Vintage, then try signing in again.';
    if (code === 'auth/unauthorized-domain') return 'Sign-in is not configured for this preview address yet.';
    return 'We couldn’t connect to your workspace. Check your connection and try again.';
  }

  async function openWorkspace(next: User | null) {
    const current = ++session;
    user = next;
    note = '';
    message = '';
    error = '';
    busy = false;
    status = next ? 'connecting' : 'ready';
    if (!next) return;
    try {
      const workspace = await loadWorkspace(next.uid);
      if (current !== session) return;
      note = workspace.note;
      status = 'ready';
    } catch (cause) {
      if (current !== session) return;
      error = explain(cause);
      status = 'error';
    }
  }

  onMount(() => {
    const unsubscribe = observeUser(openWorkspace, (cause) => { error = explain(cause); status = 'error'; });
    return () => { session++; unsubscribe(); };
  });

  async function signIn() {
    busy = true;
    error = '';
    try { await login(); } catch (cause) { error = explain(cause); } finally { busy = false; }
  }

  async function signOut() {
    busy = true;
    error = '';
    try { await logout(); } catch (cause) { error = explain(cause); } finally { busy = false; }
  }

  async function check(action: 'save' | 'storage') {
    if (!user || busy) return;
    const current = session;
    const uid = user.uid;
    busy = true;
    error = '';
    message = '';
    try {
      if (action === 'save') await saveNote(uid, note);
      else await verifyStorage(uid);
      if (current === session) message = action === 'save' ? 'Note saved and read back. It will be here after you reload.' : 'File uploaded, read back, and deleted successfully.';
    } catch (cause) {
      if (current === session) error = explain(cause);
    } finally {
      if (current === session) busy = false;
    }
  }
</script>

<svelte:head>
  <title>Vintage — List smarter. Earn more.</title>
  <meta
    name="description"
    content="Turn item photos into a Vinted listing written like you, with pricing built for value."
  />
</svelte:head>

<main class="shell" data-e2e-layout data-status={status}>
  <section class="hero" aria-labelledby="page-title">
    <a class="wordmark" href="./" aria-label="Vintage home">Vintage<span aria-hidden="true">✦</span></a>

    <div class="pitch">
      <p class="eyebrow">Your AI listing partner</p>
      <h1 id="page-title">List smarter.<br />Earn more.</h1>
      <p class="lede">
        Turn a few photos into a listing written like you, with pricing built for value.
      </p>
    </div>

    {#if !user}
    <button class="google" type="button" onclick={signIn} disabled={status !== 'ready' || busy}>
      <span class="google-mark" aria-hidden="true">G</span>
      <span>{status === 'connecting' ? 'Preparing Vintage…' : busy ? 'Signing in…' : 'Continue with Google'}</span>
    </button>
    {:else}
    <section class="workspace" aria-labelledby="workspace-title">
      <h2 id="workspace-title">Your workspace</h2>
      <p>Signed in as <strong>{user.displayName || user.email || 'Google user'}</strong></p>
      {#if status === 'ready'}
        <label for="workspace-note">Workspace note</label>
        <textarea id="workspace-note" bind:value={note} maxlength="500" disabled={busy} placeholder="Leave a note to verify that your workspace is saved."></textarea>
        <button type="button" onclick={() => check('save')} disabled={busy}>Save note</button>
        <details>
          <summary>Preview connection checks</summary>
          <p>This preview verifies account access and cloud storage. Listing creation comes next.</p>
          <button type="button" onclick={() => check('storage')} disabled={busy}>Verify file storage</button>
          <p class="technical">Project: {settings.config.projectId}<br />Workspace: {settings.workspace}<br />Revision: {settings.revision}</p>
        </details>
      {:else if status === 'error'}
        <button type="button" onclick={() => openWorkspace(user)}>Retry workspace</button>
      {:else}
        <p>Opening your workspace…</p>
      {/if}
      <button type="button" onclick={signOut} disabled={busy}>Sign out</button>
      <p role="status" class="feedback">{busy ? 'Working…' : message}</p>
    </section>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}

    <section class="learn" aria-labelledby="learn-title">
      <h2 id="learn-title">What Vintage learns</h2>
      <ul>
        <li><span aria-hidden="true">♡</span>Your listing style</li>
        <li><span class="search-icon" aria-hidden="true"></span>How you describe condition</li>
        <li><span aria-hidden="true">◇</span>Your pricing approach</li>
      </ul>
    </section>

    <p class="assurance"><span aria-hidden="true">▢</span>Your drafts stay yours until you approve them.</p>
  </section>

  <p class="backend" role="status">
    {status === 'ready' ? 'Ready' : status === 'error' ? 'Connection needs attention' : 'Connecting…'}
  </p>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { background: #faf7f0; color: #211d1d; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(body) { margin: 0; min-width: 320px; }
  :global(button), :global(a) { font: inherit; }

  .shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at 50% 22%, rgb(91 24 66 / 5%), transparent 30rem),
      #faf7f0;
  }

  .workspace { padding: 24px; border: 1px solid #d8d1c6; border-radius: 18px; background: #fff; }
  .workspace label { display: block; margin-top: 16px; }
  .workspace textarea { width: 100%; min-height: 88px; margin: 8px 0; padding: 12px; font: inherit; }
  .workspace button { min-height: 44px; margin: 8px 8px 8px 0; padding: 8px 16px; border: 1px solid #736a60; border-radius: 8px; background: #fff; color: #211d1d; }
  .workspace summary { min-height: 44px; padding-top: 12px; cursor: pointer; }
  .technical { font-size: 12px; overflow-wrap: anywhere; }
  .feedback { min-height: 24px; }
  :global(:focus-visible) { outline: 3px solid #984831; outline-offset: 3px; }
  .hero { width: min(100%, 560px); display: grid; gap: 30px; }
  .wordmark { justify-self: center; color: #58163f; font-size: 48px; font-weight: 700; text-decoration: none; letter-spacing: -2px; }
  .wordmark span { color: #6d805b; font-size: 18px; vertical-align: top; margin-left: 2px; }
  .pitch { text-align: center; }
  .eyebrow { margin: 0 0 12px; color: #6d805b; font-size: 14px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(52px, 11vw, 78px); line-height: 0.94; letter-spacing: -0.055em; }
  .lede { max-width: 460px; margin: 24px auto 0; font-size: 22px; line-height: 1.35; }
  .google { width: 100%; min-height: 68px; display: flex; align-items: center; justify-content: center; gap: 16px; border: 1px solid #d8d1c6; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgb(52 37 42 / 8%); color: #211d1d; font-size: 21px; font-weight: 700; }
  .google:disabled { color: #625d59; opacity: 0.8; }
  .google-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: conic-gradient(#4285f4 0 25%, #34a853 0 50%, #fbbc05 0 75%, #ea4335 0); color: #fff; font-weight: 700; }
  .learn { padding: 24px 26px; border: 1px solid #d7d6c8; border-radius: 22px; background: rgb(255 255 255 / 55%); box-shadow: 0 8px 28px rgb(52 37 42 / 5%); }
  h2 { margin: 0 0 12px; color: #58163f; font-size: 24px; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { min-height: 50px; display: flex; align-items: center; gap: 16px; border-top: 1px solid #e4ded3; font-size: 18px; }
  li:first-child { border-top: 0; }
  li span { width: 30px; color: #6d805b; font-size: 25px; text-align: center; }
  .search-icon { position: relative; align-self: stretch; }
  .search-icon::before { content: ''; position: absolute; top: 15px; left: 8px; width: 9px; height: 9px; border: 1px solid currentColor; border-radius: 50%; }
  .search-icon::after { content: ''; position: absolute; top: 25px; left: 6px; width: 6px; border-top: 1px solid currentColor; transform: rotate(-45deg); transform-origin: right center; }
  .assurance { margin: -8px 0 0; display: flex; justify-content: center; align-items: center; gap: 10px; color: #4e4945; font-size: 16px; text-align: center; }
  .assurance span { color: #6d805b; }
  .backend { position: fixed; right: 12px; bottom: 10px; margin: 0; color: #77716b; font-size: 12px; }

  @media (max-width: 600px) {
    .shell { place-items: start center; padding: 24px 20px 18px; }
    .workspace { padding: 24px; border: 1px solid #d8d1c6; border-radius: 18px; background: #fff; }
  .workspace label { display: block; margin-top: 16px; }
  .workspace textarea { width: 100%; min-height: 88px; margin: 8px 0; padding: 12px; font: inherit; }
  .workspace button { min-height: 44px; margin: 8px 8px 8px 0; padding: 8px 16px; border: 1px solid #736a60; border-radius: 8px; background: #fff; color: #211d1d; }
  .workspace summary { min-height: 44px; padding-top: 12px; cursor: pointer; }
  .technical { font-size: 12px; overflow-wrap: anywhere; }
  .feedback { min-height: 24px; }
  :global(:focus-visible) { outline: 3px solid #984831; outline-offset: 3px; }
  .hero { gap: 22px; }
    .wordmark { font-size: 42px; }
    .pitch { padding-top: 4px; }
    h1 { font-size: 58px; }
    .lede { margin-top: 18px; font-size: 19px; }
    .google { min-height: 62px; font-size: 19px; }
    .learn { padding: 19px 20px; }
    h2 { font-size: 22px; }
    li { min-height: 47px; font-size: 17px; }
    .assurance { font-size: 14px; }
  }
</style>

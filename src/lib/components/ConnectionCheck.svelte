<script lang="ts">
  import { onMount } from 'svelte';
  import type { User } from 'firebase/auth';
  import { settings } from '$lib/firebase';
  import { login, observeUser, explain } from '$lib/auth/session';
  import { loadWorkspace, saveNote, verifyStorage } from '$lib/repositories/workspace';

  let status: 'connecting' | 'ready' | 'error' = 'connecting';
  let user: User | null = null;
  let note = '';
  let busy = false;
  let message = '';
  let error = '';
  let session = 0;

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
    <a class="wordmark" href="/" aria-label="Vintage home">Vintage<span aria-hidden="true">✦</span></a>

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
    <section class="workspace glass" aria-labelledby="workspace-title">
      <h2 id="workspace-title">Your workspace</h2>
      <p>Signed in as <strong>{user.displayName || user.email || 'Google user'}</strong></p>
      {#if status === 'ready'}
        <label for="workspace-note">Workspace note</label>
        <textarea id="workspace-note" bind:value={note} maxlength="500" disabled={busy} placeholder="Leave a note to verify that your workspace is saved."></textarea>
        <button type="button" onclick={() => check('save')} disabled={busy}>Save note</button>
        <details>
          <summary>Preview connection checks</summary>
          <p>This preview verifies account access and cloud storage. Your drafts are available on the home screen.</p>
          <button type="button" onclick={() => check('storage')} disabled={busy}>Verify file storage</button>
          <p class="technical">Project: {settings.config.projectId}<br />Workspace: {settings.workspace}<br />Revision: {settings.revision}</p>
        </details>
      {:else if status === 'error'}
        <button type="button" onclick={() => openWorkspace(user)}>Retry workspace</button>
      {:else}
        <p>Opening your workspace…</p>
      {/if}
      <p role="status" class="feedback">{busy ? 'Working…' : message}</p>
    </section>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}

    <section class="learn glass" aria-labelledby="learn-title">
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

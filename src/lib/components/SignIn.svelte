<script lang="ts">
  import { app } from '$lib/state/app';
  import { login, explain } from '$lib/auth/session';
  import Button from './Button.svelte';
  import Status from './Status.svelte';
  let busy = false; let error = '';
  async function signIn() { busy = true; error = ''; try { await login(); } catch (cause) { error = explain(cause); } finally { busy = false; } }
</script>
<Button onclick={signIn} disabled={!$app.resolved || busy}>{!$app.resolved ? 'Preparing Vintage…' : busy ? 'Signing in…' : 'Continue with Google'}</Button>
<Status message={error} error />

<script>
  import { app } from '$lib/state/app';
  import SignIn from './SignIn.svelte';
  import Icon from './Icon.svelte';
</script>
<main class="sign-in-screen" data-e2e-layout data-status={$app.resolved ? 'ready' : 'connecting'}>
  <div class="wardrobe" aria-hidden="true"></div>
  <a class="wordmark" href="/" aria-label="Vintage home">V<span class="brand-i">i<span class="brand-star" aria-hidden="true">✦</span></span>ntage</a>
  <h1>List smarter.<br />Earn more.</h1>
  <div class="flourish" aria-hidden="true"><span></span>✦</div>
  <p class="sign-in-description">Turn a few photos into a listing written like you, with pricing built for value.</p>
  <SignIn />
  <section class="learn glass" aria-labelledby="learn-title">
    <h2 id="learn-title">What Vintage learns</h2>
    <ul>
      <li><span class="icon-disc"><Icon name="style" /></span>Your listing style</li>
      <li><span class="icon-disc"><Icon name="search" /></span>How you describe condition</li>
      <li><span class="icon-disc"><Icon name="tag" /></span>Your pricing approach</li>
    </ul>
  </section>
  <p class="privacy"><span class="icon-disc"><Icon name="lock" size={20} /></span>Your drafts stay yours until you approve them.</p>
</main>

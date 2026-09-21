<script>
  import { app } from '$lib/state/app';
  import SignIn from './SignIn.svelte';
  import Icon from './Icon.svelte';
</script>
<main class="sign-in-screen" data-e2e-layout data-status={$app.resolved ? 'ready' : 'connecting'}>
  <div class="wardrobe" aria-hidden="true"></div>
  <a class="wordmark" href="/" aria-label="Vintage home">V<span class="brand-i">i<span class="brand-star" aria-hidden="true">✦</span></span>ntage</a>
  <h1>List smarter.<br />Earn more.</h1>
  <div class="flourish" aria-hidden="true"><span></span>✦<span></span></div>
  <p class="sign-in-description">Start with photos. Review your draft and tell us how it should sound.</p>
  <SignIn />
  <section class="learn glass" aria-labelledby="learn-title">
    <h2 id="learn-title">Your listing, your words</h2>
    <ul>
      <li><span class="icon-disc"><Icon name="style" /></span>Draft from your photos</li>
      <li><span class="icon-disc"><Icon name="search" /></span>Refine the wording</li>
      <li><span class="icon-disc"><Icon name="tag" /></span>Remember your feedback</li>
    </ul>
  </section>
  <p class="privacy"><span class="icon-disc"><Icon name="lock" size={20} /></span>Your drafts stay yours until you approve them.</p>
</main>

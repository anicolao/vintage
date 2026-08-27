<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/400.css';
  import '@fontsource/atkinson-hyperlegible/700.css';
  import { onMount } from 'svelte';
  import { connectBackend } from '$lib/firebase';

  let status: 'connecting' | 'ready' | 'error' = 'connecting';

  onMount(async () => {
    try {
      await connectBackend();
      status = 'ready';
    } catch {
      status = 'error';
    }
  });
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

    <button class="google" type="button" disabled={status !== 'ready'}>
      <span class="google-mark" aria-hidden="true">G</span>
      <span>{status === 'connecting' ? 'Preparing Vintage…' : 'Continue with Google'}</span>
    </button>

    <section class="learn" aria-labelledby="learn-title">
      <h2 id="learn-title">What Vintage learns</h2>
      <ul>
        <li><span aria-hidden="true">♡</span>Your listing style</li>
        <li><span aria-hidden="true">⌕</span>How you describe condition</li>
        <li><span aria-hidden="true">◇</span>Your pricing approach</li>
      </ul>
    </section>

    <p class="assurance"><span aria-hidden="true">▢</span>Your drafts stay yours until you approve them.</p>
  </section>

  <p class="backend" role="status">
    {status === 'ready' ? 'Prototype ready' : status === 'error' ? 'Connection needs attention' : 'Connecting…'}
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
  .assurance { margin: -8px 0 0; display: flex; justify-content: center; align-items: center; gap: 10px; color: #4e4945; font-size: 16px; text-align: center; }
  .assurance span { color: #6d805b; }
  .backend { position: fixed; right: 12px; bottom: 10px; margin: 0; color: #77716b; font-size: 12px; }

  @media (max-width: 600px) {
    .shell { place-items: start center; padding: 24px 20px 18px; }
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

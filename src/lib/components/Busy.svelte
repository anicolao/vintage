<script lang="ts">
  export let label:string;
  export let value:number|undefined=undefined;
  export let max=100;
  export let compact=false;
</script>
<span class="busy" class:compact role="status" aria-live="polite">
  <span class="spinner" aria-hidden="true"></span><span>{label}</span>
  {#if value!==undefined}<progress {value} {max} aria-label={label}></progress>{/if}
</span>
<style>
  .busy {display:flex;align-items:center;flex-wrap:wrap;gap:.6rem; padding:.5rem 0; font-size:.9rem; color:var(--text);}
  .compact {font-size:.8rem; padding:0;}
  .spinner {width:1em;height:1em;flex:none;border:2px solid var(--accent);border-right-color:transparent;border-radius:50%;animation:spin .9s linear infinite;}
  progress {width:100%;height:.4rem;accent-color:var(--accent);border:0;border-radius:1rem;overflow:hidden;}
  progress::-webkit-progress-bar {background:var(--line);border-radius:1rem;}
  progress::-webkit-progress-value {background:var(--accent);border-radius:1rem;}
  @keyframes spin {to {transform:rotate(360deg);}}
  @media(prefers-reduced-motion:reduce){.spinner {animation:none;border-style:dotted;}}
</style>

<script lang="ts">
  export let name: 'style' | 'search' | 'tag' | 'lock' | 'back' | 'camera' | 'plus' | 'close' | 'up' | 'down' | 'check' | 'next' | 'logout' | 'photos' | 'cloud' | 'star' | 'replace' | 'trash' | 'more';
  export let size = 24;
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'style'}<path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8l-6 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M12 14s-5-3-5-6a2.5 2.5 0 0 1 5-1 2.5 2.5 0 0 1 5 1c0 3-5 6-5 6Z"/>
  {:else if name === 'search'}<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>
  {:else if name === 'tag'}<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/>
  {:else if name === 'lock'}<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>
  {:else if name === 'back'}<path d="m11 4-8 8 8 8M3 12h18"/>
  {:else if name === 'camera'}<path d="M3 6h4l2-3h6l2 3h4v15H3Z"/><circle cx="12" cy="13" r="4"/>
  {:else if name === 'plus'}<path d="M12 4v16M4 12h16"/>
  {:else if name === 'close'}<path d="m5 5 14 14M19 5 5 19"/>
  {:else if name === 'up'}<path d="m5 15 7-7 7 7"/>
  {:else if name === 'down'}<path d="m5 9 7 7 7-7"/>
  {:else if name === 'next'}<path d="m9 5 7 7-7 7"/>
  {:else if name === 'logout'}<path d="M9 4H4v16h5m4-15h6v14h-6M8 12h8m-3-3 3 3-3 3"/>
  {:else if name === 'photos'}<rect x="5" y="3" width="16" height="18" rx="2"/><path d="M2 6v15m5-4 4-5 3 3 2-2 3 4"/><circle cx="10" cy="8" r="1"/>
  {:else if name === 'cloud'}<path d="M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10Z"/>
  {:else if name === 'star'}<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>
  {:else if name === 'replace'}<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>
  {:else if name === 'trash'}<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>
  {:else if name === 'more'}<circle cx="4" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="20" cy="12" r="1"/>
  {:else}<path d="m4 12 5 5L20 6"/>{/if}
</svg>

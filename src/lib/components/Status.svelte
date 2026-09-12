<script lang="ts">export let message = ''; export let error = false;</script>
{#if message}<p class:notice-error={error} class="notice" role={error ? 'alert' : 'status'}>{message}</p>{/if}

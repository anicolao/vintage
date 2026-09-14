<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { watchWorkflow, workflows, emptyWorkflow } from '$lib/state/pipeline';
  import PhotoEntry from './PhotoEntry.svelte';
  import ReviewListing from './ReviewListing.svelte';
  export let id:string;export let uid:string;
  onMount(()=>watchWorkflow(uid,id));
  $: workflow=$workflows[id] || emptyWorkflow();
  $: photos=$page.url.searchParams.get('view')==='photos' && workflow.status!=='approved' && workflow.status!=='approval-pending';
</script>
{#if photos || workflow.status==='draft'}<PhotoEntry {id} {uid}/>{:else}<ReviewListing {id} {uid} {workflow}/>{/if}

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { watchWorkflow, workflows, emptyWorkflow, pipelineRestored } from '$lib/state/pipeline';
  import PhotoEntry from './PhotoEntry.svelte';
  import ReviewListing from './ReviewListing.svelte';
  export let id:string;export let uid:string;
  onMount(()=>watchWorkflow(uid,id));
  $: workflow=$workflows[id] || emptyWorkflow();
  $: photos=$page.url.searchParams.get('view')==='photos' && (workflow.proposal?.schemaVersion!==2 || (workflow.status!=='approved' && workflow.status!=='approval-pending'));
</script>
{#if !$pipelineRestored || !$workflows[id]}<main class="loading-screen"><p role="status">Opening your item…</p></main>{:else if photos || workflow.status==='draft'}<PhotoEntry {id} {uid}/>{:else}<ReviewListing {id} {uid} {workflow}/>{/if}

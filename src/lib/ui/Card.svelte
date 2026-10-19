<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title = '',
		children,
		className = '',
	}: { title?: string; children: Snippet; className?: string } = $props();
</script>

<section class="rounded-card bg-surface p-5 shadow-sm ring-1 ring-line {className}">
	{#if title}
		<h2 class="mb-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
	{/if}
	{@render children()}
</section>

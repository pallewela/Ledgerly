<script lang="ts">
	import { onMount } from 'svelte';
	import { registerSW } from 'virtual:pwa-register';

	let offlineReady = $state(false);
	let needRefresh = $state(false);
	let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

	onMount(() => {
		updateServiceWorker = registerSW({
			onOfflineReady() {
				offlineReady = true;
			},
			onNeedRefresh() {
				needRefresh = true;
			},
		});
	});
</script>

{#if needRefresh || offlineReady}
	<div
		class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm shadow-lg ring-1 ring-line"
		role="status"
		aria-live="polite"
	>
		{#if needRefresh}
			<span>A new version of Ledgerly is ready.</span>
			<button class="font-medium text-accent underline" onclick={() => updateServiceWorker?.(true)}
				>Reload</button
			>
		{:else}
			<span>Ready offline — Ledgerly works without a connection.</span>
			<button
				class="text-ink-soft hover:text-ink"
				aria-label="Dismiss"
				onclick={() => (offlineReady = false)}>×</button
			>
		{/if}
	</div>
{/if}

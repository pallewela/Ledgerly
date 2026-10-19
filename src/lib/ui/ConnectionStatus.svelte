<script lang="ts">
	import { onMount } from 'svelte';

	let online = $state(true);

	onMount(() => {
		online = navigator.onLine;
		const goOnline = () => (online = true);
		const goOffline = () => (online = false);
		window.addEventListener('online', goOnline);
		window.addEventListener('offline', goOffline);
		return () => {
			window.removeEventListener('online', goOnline);
			window.removeEventListener('offline', goOffline);
		};
	});
</script>

{#if !online}
	<div
		class="border-b border-attention/30 bg-attention-soft px-4 py-2 text-center text-xs text-attention"
		role="status"
		aria-live="polite"
	>
		Offline — Ledgerly still works. Everything is saved on this device.
	</div>
{/if}

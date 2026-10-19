<script lang="ts">
	import { formatMoney } from '$lib/engine/currency';

	let {
		minor,
		currency,
		signed = false,
		className = '',
	}: { minor: number; currency: string; signed?: boolean; className?: string } = $props();
</script>

<span class="tnum {className}">{formatMoney({ minorUnits: minor, currency }, { signed })}</span>

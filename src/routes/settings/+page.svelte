<script lang="ts">
	import { onMount } from 'svelte';
	import { currentRepository, initLedger } from '$lib/app/ledger';
	import {
		SUPPORTED_DISPLAY_CURRENCIES,
		getBaseCurrency,
		getFxTable,
		setBaseCurrency,
		setFxRates,
	} from '$lib/app/settings';
	import { exportSnapshot, restoreSnapshot, type LedgerSnapshot } from '$lib/storage';
	import Card from '$lib/ui/Card.svelte';

	const FX_CODES = ['USD', 'AUD', 'EUR', 'GBP', 'INR'];

	let base = $state('LKR');
	let rates = $state<Record<string, string>>({});
	let loading = $state(true);
	let message = $state<string | null>(null);
	let error = $state<string | null>(null);
	let restoring = $state(false);

	onMount(async () => {
		try {
			await initLedger();
			const repo = currentRepository();
			base = await getBaseCurrency(repo);
			const table = await getFxTable(repo);
			for (const code of FX_CODES) {
				rates[code] = table.rates[code] !== undefined ? String(table.rates[code]) : '';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	async function saveBaseCurrency() {
		try {
			await setBaseCurrency(currentRepository(), base);
			message = `Reporting currency is now ${base}. Re-enter FX rates relative to ${base}.`;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function saveRates(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		const parsed: Record<string, number> = {};
		for (const [code, value] of Object.entries(rates)) {
			if (!value.trim()) continue;
			const rate = Number(value);
			if (!Number.isFinite(rate) || rate <= 0) {
				error = `Rate for ${code} must be a positive number.`;
				return;
			}
			parsed[code] = rate;
		}
		try {
			await setFxRates(currentRepository(), parsed);
			message = 'Rates saved. Reports now use these explicit rates.';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function download() {
		try {
			const snapshot = await exportSnapshot(currentRepository());
			const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `ledgerly-export-${new Date().toISOString().slice(0, 10)}.json`;
			anchor.click();
			URL.revokeObjectURL(url);
			message = 'Full export downloaded — every account, transaction, budget and rule.';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function restore(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		restoring = true;
		error = null;
		try {
			const snapshot = JSON.parse(await file.text()) as LedgerSnapshot;
			await restoreSnapshot(currentRepository(), snapshot, 'replace');
			message = 'Restored. Reloading…';
			setTimeout(() => location.reload(), 700);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			restoring = false;
		}
	}

	async function wipe() {
		const answer = prompt(
			'This deletes every account, transaction, budget and setting on this device. Type DELETE to confirm.',
		);
		if (answer !== 'DELETE') return;
		await currentRepository().clear();
		location.reload();
	}
</script>

<svelte:head><title>Settings · Ledgerly</title></svelte:head>

<h1 class="mb-6 text-2xl font-semibold">Settings</h1>

{#if loading}
	<p class="text-sm text-ink-soft">Loading…</p>
{:else}
	{#if message}
		<p class="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{message}</p>
	{/if}
	{#if error}
		<p class="mb-4 rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">{error}</p>
	{/if}

	<Card title="Reporting currency">
		<p class="mb-3 text-sm text-ink-soft">
			Accounts keep their own currency (LKR / USD / AUD …). Net worth, budgets and reports convert
			to this base currency using the explicit rates below.
		</p>
		<div class="flex flex-wrap items-center gap-3">
			<select class="rounded-lg border border-line bg-paper px-3 py-2 text-sm" bind:value={base}>
				{#each SUPPORTED_DISPLAY_CURRENCIES as code (code)}
					<option value={code}>{code}</option>
				{/each}
			</select>
			<button class="rounded-lg bg-accent px-4 py-2 text-sm text-white" onclick={saveBaseCurrency}
				>Save currency</button
			>
		</div>
	</Card>

	<Card title={`FX rates · units of ${base} per 1 unit`} className="mt-4">
		<form class="grid gap-3 md:grid-cols-3" onsubmit={saveRates}>
			{#each FX_CODES as code (code)}
				<label class="text-sm">
					<span class="mb-1 block text-xs text-ink-soft">1 {code} = ? {base}</span>
					<input
						class="w-full rounded-lg border border-line bg-paper px-3 py-2"
						bind:value={rates[code]}
						placeholder={code === 'USD' ? '300' : '—'}
						inputmode="decimal"
					/>
				</label>
			{/each}
			<div class="self-end md:col-span-3">
				<button class="rounded-lg bg-accent px-4 py-2 text-sm text-white">Save rates</button>
				<span class="ml-3 text-xs text-ink-soft"
					>Missing rates are surfaced in reports, never guessed.</span
				>
			</div>
		</form>
	</Card>

	<Card title="Your data" className="mt-4">
		<div class="grid gap-6 md:grid-cols-2">
			<div>
				<p class="mb-2 text-sm text-ink-soft">
					Everything lives in this browser on this device. Export a full snapshot to move devices or
					keep a backup — no support ticket needed.
				</p>
				<button class="rounded-lg bg-accent px-4 py-2 text-sm text-white" onclick={download}
					>Download full export</button
				>
			</div>
			<div>
				<p class="mb-2 text-sm text-ink-soft">
					Restore a previous export. This <strong>replaces</strong> everything currently on this device.
				</p>
				<label class="inline-block cursor-pointer rounded-lg px-4 py-2 text-sm ring-1 ring-line">
					{restoring ? 'Restoring…' : 'Choose export file…'}
					<input type="file" accept="application/json" class="hidden" onchange={restore} />
				</label>
			</div>
		</div>
	</Card>

	<Card title="Danger zone" className="mt-4">
		<p class="mb-3 text-sm text-ink-soft">
			Delete every account, transaction, budget, rule and setting stored in this browser. This
			cannot be undone.
		</p>
		<button
			class="rounded-lg px-4 py-2 text-sm text-negative ring-1 ring-negative/40"
			onclick={wipe}>Delete all data…</button
		>
	</Card>
{/if}

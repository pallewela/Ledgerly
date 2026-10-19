<script lang="ts">
	import { onMount } from 'svelte';
	import { currentEngine, initLedger } from '$lib/app/ledger';
	import { parseUserAmount } from '$lib/app/format';
	import { todayIso } from '$lib/engine/util';
	import type { Account } from '$lib/engine/types';
	import Card from '$lib/ui/Card.svelte';
	import Money from '$lib/ui/Money.svelte';

	const CURRENCIES = ['LKR', 'USD', 'AUD', 'EUR', 'GBP', 'INR'];
	const TYPES = [
		{ value: 'checking', label: 'Checking' },
		{ value: 'savings', label: 'Savings' },
		{ value: 'credit_card', label: 'Credit card' },
		{ value: 'cash', label: 'Cash' },
		{ value: 'loan', label: 'Loan' },
		{ value: 'mortgage', label: 'Mortgage' },
		{ value: 'asset', label: 'Asset (home, vehicle…)' },
	];

	let accounts = $state<Account[]>([]);
	let balances = $state<Record<string, number>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);

	let name = $state('');
	let type = $state('checking');
	let currency = $state('LKR');
	let opening = $state('');
	let saving = $state(false);
	let formError = $state<string | null>(null);

	async function reload() {
		const engine = currentEngine();
		accounts = await engine.listAccounts();
		const entries = await Promise.all(
			accounts.map(async (a) => [a.id, await engine.computeBalance(a.id, todayIso())] as const),
		);
		balances = Object.fromEntries(entries);
	}

	onMount(async () => {
		try {
			await initLedger();
			await reload();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	async function addAccount(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		const openingMinor = opening.trim() ? parseUserAmount(opening, currency) : 0;
		if (openingMinor === null) {
			formError = 'Opening balance is not a valid amount.';
			return;
		}
		saving = true;
		try {
			await currentEngine().createAccount({
				name,
				type: type as Account['type'],
				currency,
				openingBalanceMinor: openingMinor,
			});
			name = '';
			opening = '';
			await reload();
		} catch (e) {
			formError = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Accounts · Ledgerly</title></svelte:head>

<div class="mb-6 flex items-baseline justify-between">
	<h1 class="text-2xl font-semibold">Accounts</h1>
	<span class="text-sm text-ink-soft">{accounts.length} active</span>
</div>

{#if loading}
	<p class="text-sm text-ink-soft">Loading…</p>
{:else if error}
	<p class="text-sm text-negative">{error}</p>
{:else}
	<div class="grid gap-4 md:grid-cols-2">
		{#each accounts as account (account.id)}
			<Card>
				<div class="flex items-baseline justify-between">
					<div>
						<p class="font-medium">{account.name}</p>
						<p class="text-xs text-ink-soft">
							{account.institution ?? account.type.replace('_', ' ')} · {account.currency}
						</p>
					</div>
					<p class="tnum text-lg">
						<Money
							minor={balances[account.id] ?? account.openingBalanceMinor}
							currency={account.currency}
						/>
					</p>
				</div>
			</Card>
		{/each}
		{#if accounts.length === 0}
			<Card className="md:col-span-2">
				<p class="text-sm text-ink-soft">
					No accounts yet. Add your bank account, card, cash, or a loan — balances start from the
					opening figure you enter and then follow your transactions.
				</p>
			</Card>
		{/if}
	</div>

	<Card title="Add an account" className="mt-6">
		<form class="grid gap-3 md:grid-cols-5" onsubmit={addAccount}>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">Name</span>
				<input
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={name}
					placeholder="Day-to-day"
					required
				/>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Type</span>
				<select class="w-full rounded-lg border border-line bg-paper px-3 py-2" bind:value={type}>
					{#each TYPES as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Currency</span>
				<select
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={currency}
				>
					{#each CURRENCIES as code (code)}
						<option value={code}>{code}</option>
					{/each}
				</select>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Opening balance</span>
				<input
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={opening}
					placeholder="0.00"
					inputmode="decimal"
				/>
			</label>
			<div class="md:col-span-5">
				{#if formError}
					<p class="mb-2 text-sm text-negative">{formError}</p>
				{/if}
				<button
					class="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
					disabled={saving}
				>
					{saving ? 'Saving…' : 'Add account'}
				</button>
			</div>
		</form>
	</Card>
{/if}

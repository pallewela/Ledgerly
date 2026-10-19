<script lang="ts">
	import { onMount } from 'svelte';
	import { currentEngine, currentRepository, initLedger } from '$lib/app/ledger';
	import { getBaseCurrency } from '$lib/app/settings';
	import { parseUserAmount } from '$lib/app/format';
	import type { Account, Bill } from '$lib/engine/types';
	import Card from '$lib/ui/Card.svelte';
	import Money from '$lib/ui/Money.svelte';

	let bills = $state<Bill[]>([]);
	let upcoming = $state<Array<{ bill: Bill; dueDate: string }>>([]);
	let accounts = $state<Account[]>([]);
	let base = $state('LKR');
	let loading = $state(true);
	let error = $state<string | null>(null);

	let name = $state('');
	let amount = $state('');
	let dueDay = $state(1);
	let accountId = $state('');
	let saving = $state(false);
	let formError = $state<string | null>(null);

	async function load() {
		const engine = currentEngine();
		bills = await engine.listBills();
		upcoming = await engine.upcomingBills(30);
		accounts = await engine.listAccounts();
	}

	onMount(async () => {
		try {
			await initLedger();
			base = await getBaseCurrency(currentRepository());
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	async function add(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		const minor = amount.trim() ? parseUserAmount(amount, base) : null;
		if (amount.trim() && (minor === null || minor <= 0)) {
			formError = 'Amount is not valid.';
			return;
		}
		saving = true;
		try {
			await currentEngine().createBill({
				name,
				amountMinor: minor,
				dueDay: Number(dueDay),
				accountId: accountId || null,
			});
			name = '';
			amount = '';
			await load();
		} catch (e) {
			formError = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Bills · Ledgerly</title></svelte:head>

<div class="mb-6 flex items-baseline justify-between">
	<h1 class="text-2xl font-semibold">Bills</h1>
	<span class="text-sm text-ink-soft">Reminders only — nothing is paid from here</span>
</div>

{#if loading}
	<p class="text-sm text-ink-soft">Loading…</p>
{:else if error}
	<p class="text-sm text-negative">{error}</p>
{:else}
	<div class="grid gap-4 md:grid-cols-2">
		<Card title="Next 30 days">
			{#if upcoming.length === 0}
				<p class="text-sm text-ink-soft">Nothing due in the next 30 days.</p>
			{:else}
				<ul class="space-y-2 text-sm">
					{#each upcoming as row (row.bill.id)}
						<li class="flex items-baseline justify-between border-b border-line pb-2">
							<span>
								{row.bill.name}
								<span class="ml-2 text-xs text-ink-soft">{row.dueDate}</span>
							</span>
							{#if row.bill.amountMinor !== null}
								<Money minor={row.bill.amountMinor} currency={base} className="text-ink-soft" />
							{:else}
								<span class="text-xs text-ink-soft">variable</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		<Card title="All bills">
			{#if bills.length === 0}
				<p class="text-sm text-ink-soft">No bills yet.</p>
			{:else}
				<ul class="space-y-2 text-sm">
					{#each bills as bill (bill.id)}
						<li class="flex items-baseline justify-between border-b border-line pb-2">
							<span
								>{bill.name}<span class="ml-2 text-xs text-ink-soft">day {bill.dueDay}</span></span
							>
							{#if bill.amountMinor !== null}
								<Money minor={bill.amountMinor} currency={base} className="text-ink-soft" />
							{:else}
								<span class="text-xs text-ink-soft">variable</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>

	<Card title="Add a bill" className="mt-4">
		<form class="grid gap-3 md:grid-cols-5" onsubmit={add}>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">Name</span>
				<input
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={name}
					placeholder="Internet"
					required
				/>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Amount (optional)</span>
				<input
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={amount}
					placeholder="6,000"
					inputmode="decimal"
				/>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Due day</span>
				<input
					type="number"
					min="1"
					max="31"
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={dueDay}
				/>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Account (optional)</span>
				<select
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={accountId}
				>
					<option value="">None</option>
					{#each accounts as account (account.id)}
						<option value={account.id}>{account.name}</option>
					{/each}
				</select>
			</label>
			<div class="md:col-span-5">
				{#if formError}
					<p class="mb-2 text-sm text-negative">{formError}</p>
				{/if}
				<button
					class="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
					disabled={saving}>{saving ? 'Saving…' : 'Add bill'}</button
				>
			</div>
		</form>
	</Card>
{/if}

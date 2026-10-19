<script lang="ts">
	import { onMount } from 'svelte';
	import { currentEngine, initLedger } from '$lib/app/ledger';
	import { parseUserAmount } from '$lib/app/format';
	import { todayIso } from '$lib/engine/util';
	import type { Account, Category, Transaction } from '$lib/engine/types';
	import Card from '$lib/ui/Card.svelte';
	import Money from '$lib/ui/Money.svelte';

	let accounts = $state<Account[]>([]);
	let categories = $state<Category[]>([]);
	let transactions = $state<Transaction[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let accountFilter = $state('');
	let search = $state('');

	let accountId = $state('');
	let date = $state(todayIso());
	let payee = $state('');
	let amount = $state('');
	let categoryId = $state('');
	let saving = $state(false);
	let formError = $state<string | null>(null);

	const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
	const accountCurrency = (id: string) => accounts.find((a) => a.id === id)?.currency ?? 'LKR';
	const categoryName = (id: string | null) =>
		id ? (categories.find((c) => c.id === id)?.name ?? '—') : 'Uncategorized';

	const filtered = $derived(
		transactions.filter((tx) => {
			if (accountFilter && tx.accountId !== accountFilter) return false;
			if (search && !tx.payee.toLowerCase().includes(search.toLowerCase())) return false;
			return true;
		}),
	);

	async function reload() {
		const engine = currentEngine();
		transactions = await engine.listTransactions({ limit: 200 });
	}

	onMount(async () => {
		try {
			await initLedger();
			const engine = currentEngine();
			accounts = await engine.listAccounts();
			categories = await engine.listCategories();
			accountId = accounts[0]?.id ?? '';
			await reload();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	async function add(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		const account = accounts.find((a) => a.id === accountId);
		if (!account) {
			formError = 'Choose an account first.';
			return;
		}
		const minor = parseUserAmount(amount, account.currency);
		if (minor === null || minor === 0) {
			formError = 'Enter a non-zero amount (negative for money out).';
			return;
		}
		saving = true;
		try {
			const engine = currentEngine();
			await engine.addTransaction({
				accountId,
				date,
				payee,
				amountMinor: minor,
				categoryId: categoryId || null,
			});
			if (categoryId) await engine.rememberPayeeChoice(payee, accountId, categoryId);
			payee = '';
			amount = '';
			await reload();
		} catch (e) {
			formError = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		if (!confirm('Delete this transaction? A linked transfer leg is removed too.')) return;
		await currentEngine().deleteTransaction(id);
		await reload();
	}
</script>

<svelte:head><title>Transactions · Ledgerly</title></svelte:head>

<div class="mb-6 flex flex-wrap items-baseline justify-between gap-3">
	<h1 class="text-2xl font-semibold">Transactions</h1>
	<div class="flex gap-2 text-sm">
		<select class="rounded-lg border border-line bg-surface px-3 py-2" bind:value={accountFilter}>
			<option value="">All accounts</option>
			{#each accounts as account (account.id)}
				<option value={account.id}>{account.name}</option>
			{/each}
		</select>
		<input
			class="rounded-lg border border-line bg-surface px-3 py-2"
			placeholder="Search payee…"
			bind:value={search}
		/>
	</div>
</div>

{#if loading}
	<p class="text-sm text-ink-soft">Loading…</p>
{:else if error}
	<p class="text-sm text-negative">{error}</p>
{:else}
	<Card title="Quick add">
		<form class="grid gap-3 md:grid-cols-6" onsubmit={add}>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">Account</span>
				<select
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={accountId}
				>
					{#each accounts as account (account.id)}
						<option value={account.id}>{account.name} · {account.currency}</option>
					{/each}
				</select>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Date</span>
				<input
					type="date"
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={date}
				/>
			</label>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">Payee</span>
				<input
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={payee}
					placeholder="Keells"
					required
				/>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Amount</span>
				<input
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={amount}
					placeholder="-1,500.00"
					inputmode="decimal"
					required
				/>
			</label>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">Category</span>
				<select
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={categoryId}
				>
					<option value="">Uncategorized</option>
					{#each categories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</label>
			<div class="self-end text-xs text-ink-soft md:col-span-2">
				Negative = money out · typing a category teaches the payee
			</div>
			<div class="md:col-span-6">
				{#if formError}
					<p class="mb-2 text-sm text-negative">{formError}</p>
				{/if}
				<button
					class="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
					disabled={saving}>{saving ? 'Saving…' : 'Add transaction'}</button
				>
			</div>
		</form>
	</Card>

	<Card title="All transactions" className="mt-4">
		{#if filtered.length === 0}
			<p class="text-sm text-ink-soft">No transactions match.</p>
		{:else}
			<table class="w-full text-sm">
				<thead class="text-left text-xs text-ink-soft">
					<tr>
						<th class="pb-2 font-medium">Date</th>
						<th class="pb-2 font-medium">Payee</th>
						<th class="pb-2 font-medium">Account</th>
						<th class="pb-2 font-medium">Category</th>
						<th class="pb-2 text-right font-medium">Amount</th>
						<th class="pb-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as tx (tx.id)}
						<tr class="border-t border-line">
							<td class="py-2 text-ink-soft">{tx.date}</td>
							<td class="py-2"
								>{tx.payee}{#if tx.transferId}<span class="ml-2 text-xs text-ink-soft"
										>transfer</span
									>{/if}</td
							>
							<td class="py-2 text-ink-soft">{accountName(tx.accountId)}</td>
							<td class="py-2 text-ink-soft">{categoryName(tx.categoryId)}</td>
							<td class="py-2 text-right">
								<Money
									minor={tx.amountMinor}
									currency={accountCurrency(tx.accountId)}
									signed
									className={tx.amountMinor < 0 ? 'text-negative' : 'text-positive'}
								/>
							</td>
							<td class="py-2 text-right">
								<button
									class="text-xs text-ink-soft hover:text-negative"
									onclick={() => remove(tx.id)}>delete</button
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card>
{/if}

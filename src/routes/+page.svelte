<script lang="ts">
	import { onMount } from 'svelte';
	import { currentEngine, currentRepository, initLedger } from '$lib/app/ledger';
	import { getBaseCurrency, getFxTable } from '$lib/app/settings';
	import { todayIso } from '$lib/engine/util';
	import type { Account, Bill, Category, Transaction } from '$lib/engine/types';
	import type { MonthSummary, NetWorthReport } from '$lib/engine/api';
	import Card from '$lib/ui/Card.svelte';
	import Money from '$lib/ui/Money.svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let base = $state('LKR');
	let accounts = $state<Account[]>([]);
	let categories = $state<Category[]>([]);
	let nw = $state<NetWorthReport | null>(null);
	let summary = $state<MonthSummary | null>(null);
	let bills = $state<Array<{ bill: Bill; dueDate: string }>>([]);
	let recent = $state<Transaction[]>([]);
	let uncategorized = $state(0);

	const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
	const categoryName = (id: string | null) =>
		id ? (categories.find((c) => c.id === id)?.name ?? '—') : 'Uncategorized';

	onMount(async () => {
		try {
			await initLedger();
			const engine = currentEngine();
			const repo = currentRepository();
			base = await getBaseCurrency(repo);
			const fx = await getFxTable(repo);
			const today = todayIso();
			accounts = await engine.listAccounts();
			categories = await engine.listCategories();
			nw = await engine.netWorth(today, base, fx);
			summary = await engine.monthSummary(today.slice(0, 7), base, fx);
			bills = await engine.upcomingBills(14);
			recent = await engine.listTransactions({ limit: 8 });
			uncategorized = (await engine.listTransactions({ categoryId: null })).filter(
				(t) => !t.transferId,
			).length;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head><title>Ledgerly</title></svelte:head>

<div class="mb-6 flex items-baseline justify-between">
	<h1 class="text-2xl font-semibold">Your money, today</h1>
	<span class="text-sm text-ink-soft">Reporting in {base}</span>
</div>

{#if loading}
	<p class="text-sm text-ink-soft">Opening your ledger…</p>
{:else if error}
	<Card title="Something went wrong">
		<p class="text-sm text-negative">{error}</p>
	</Card>
{:else if accounts.length === 0}
	<Card title="Start here">
		<p class="text-sm text-ink-soft">
			Add an account with its current balance — or import a bank statement — and this page becomes
			your calm, one-glance picture of the month.
		</p>
		<div class="mt-4 flex gap-3">
			<a class="rounded-lg bg-accent px-4 py-2 text-sm text-white" href="/accounts"
				>Add an account</a
			>
			<a class="rounded-lg px-4 py-2 text-sm ring-1 ring-line" href="/import">Import a statement</a>
		</div>
	</Card>
{:else}
	<div class="grid gap-4 md:grid-cols-3">
		<Card title="Net worth" className="md:col-span-2">
			{#if nw}
				<p class="text-4xl font-semibold">
					<Money minor={nw.totalInBaseMinor} currency={base} />
				</p>
				<p class="mt-1 text-xs text-ink-soft">Assets minus liabilities · {base}</p>
				{#if nw.perCurrency.length > 0}
					<ul class="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
						{#each nw.perCurrency as row (row.currency)}
							<li>
								<span class="text-ink">{row.currency}</span>
								<span class="tnum"><Money minor={row.totalMinor} currency={row.currency} /></span>
							</li>
						{/each}
					</ul>
				{/if}
				{#if nw.missingRates.length > 0}
					<p class="mt-3 rounded-lg bg-attention-soft px-3 py-2 text-xs text-attention">
						No {base} rate for {nw.missingRates.join(', ')} — those balances are excluded. Set rates in
						<a class="underline" href="/settings">Settings</a>.
					</p>
				{/if}
				<a class="mt-4 inline-block text-sm text-accent hover:underline" href="/accounts"
					>Manage accounts →</a
				>
			{/if}
		</Card>

		<Card title="This month">
			{#if summary}
				<dl class="space-y-3 text-sm">
					<div class="flex justify-between">
						<dt class="text-ink-soft">Money in</dt>
						<dd class="text-positive">
							<Money minor={summary.incomeInBaseMinor} currency={base} />
						</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-ink-soft">Money out</dt>
						<dd class="text-negative">
							<Money minor={summary.expenseInBaseMinor} currency={base} />
						</dd>
					</div>
					<div class="flex justify-between border-t border-line pt-3 font-medium">
						<dt>Net</dt>
						<dd><Money minor={summary.netInBaseMinor} currency={base} signed /></dd>
					</div>
				</dl>
				{#if summary.missingRates.length > 0}
					<p class="mt-3 text-xs text-attention">
						Missing rates: {summary.missingRates.join(', ')}
					</p>
				{/if}
				<a class="mt-4 inline-block text-sm text-accent hover:underline" href="/budgets"
					>Budgets →</a
				>
			{/if}
		</Card>
	</div>

	<div class="mt-4 grid gap-4 md:grid-cols-2">
		<Card title="Upcoming bills · next 14 days">
			{#if bills.length === 0}
				<p class="text-sm text-ink-soft">Nothing due in the next two weeks.</p>
			{:else}
				<ul class="space-y-2 text-sm">
					{#each bills as row (row.bill.id)}
						<li class="flex items-baseline justify-between border-b border-line pb-2">
							<span
								>{row.bill.name}<span class="ml-2 text-xs text-ink-soft">{row.dueDate}</span></span
							>
							{#if row.bill.amountMinor !== null}
								<Money minor={row.bill.amountMinor} currency={base} className="text-ink-soft" />
							{:else}
								<span class="text-xs text-ink-soft">variable</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			<a class="mt-4 inline-block text-sm text-accent hover:underline" href="/bills">Bills →</a>
		</Card>

		<Card title="Needs attention">
			<ul class="space-y-2 text-sm">
				<li class="flex items-baseline justify-between border-b border-line pb-2">
					<span>Uncategorized transactions</span>
					{#if uncategorized > 0}
						<a class="text-attention hover:underline" href="/transactions?category=uncategorized"
							>{uncategorized} to review →</a
						>
					{:else}
						<span class="text-ink-soft">All clear</span>
					{/if}
				</li>
				<li class="flex items-baseline justify-between">
					<span>Missing FX rates</span>
					{#if nw && nw.missingRates.length > 0}
						<a class="text-attention hover:underline" href="/settings"
							>{nw.missingRates.join(', ')} →</a
						>
					{:else}
						<span class="text-ink-soft">All set</span>
					{/if}
				</li>
			</ul>
		</Card>
	</div>

	<Card title="Recent activity" className="mt-4">
		{#if recent.length === 0}
			<p class="text-sm text-ink-soft">No transactions yet.</p>
		{:else}
			<table class="w-full text-sm">
				<thead class="text-left text-xs text-ink-soft">
					<tr>
						<th class="pb-2 font-medium">Date</th>
						<th class="pb-2 font-medium">Payee</th>
						<th class="pb-2 font-medium">Account</th>
						<th class="pb-2 font-medium">Category</th>
						<th class="pb-2 text-right font-medium">Amount</th>
					</tr>
				</thead>
				<tbody>
					{#each recent as tx (tx.id)}
						<tr class="border-t border-line">
							<td class="py-2 text-ink-soft">{tx.date}</td>
							<td class="py-2">{tx.payee}</td>
							<td class="py-2 text-ink-soft">{accountName(tx.accountId)}</td>
							<td class="py-2 text-ink-soft">{categoryName(tx.categoryId)}</td>
							<td class="py-2 text-right">
								<Money
									minor={tx.amountMinor}
									currency={accounts.find((a) => a.id === tx.accountId)?.currency ?? base}
									signed
									className={tx.amountMinor < 0 ? 'text-negative' : 'text-positive'}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<a class="mt-4 inline-block text-sm text-accent hover:underline" href="/transactions"
				>All transactions →</a
			>
		{/if}
	</Card>
{/if}

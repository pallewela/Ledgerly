<script lang="ts">
	import { onMount } from 'svelte';
	import { currentEngine, currentRepository, initLedger } from '$lib/app/ledger';
	import { getBaseCurrency, getFxTable } from '$lib/app/settings';
	import { parseUserAmount } from '$lib/app/format';
	import { todayIso } from '$lib/engine/util';
	import type { Budget, Category } from '$lib/engine/types';
	import type { BudgetStatus } from '$lib/engine/api';
	import Card from '$lib/ui/Card.svelte';
	import Money from '$lib/ui/Money.svelte';

	let month = $state(todayIso().slice(0, 7));
	let base = $state('LKR');
	let categories = $state<Category[]>([]);
	let budgets = $state<Budget[]>([]);
	let status = $state<BudgetStatus | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let categoryId = $state('');
	let limit = $state('');
	let saving = $state(false);
	let formError = $state<string | null>(null);

	const paceLabel: Record<string, string> = {
		under: 'under',
		'on-pace': 'on pace',
		'projected-over': 'trending over',
		over: 'over budget',
	};

	const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
	const expenseCategories = $derived(categories.filter((c) => c.kind === 'expense'));

	async function load() {
		const engine = currentEngine();
		const repo = currentRepository();
		base = await getBaseCurrency(repo);
		const fx = await getFxTable(repo);
		categories = await engine.listCategories();
		budgets = await engine.listBudgets(month);
		status = await engine.budgetStatus(month, fx);
	}

	onMount(async () => {
		try {
			await initLedger();
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	async function saveBudget(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		const minor = parseUserAmount(limit, base);
		if (!categoryId) {
			formError = 'Choose a category.';
			return;
		}
		if (minor === null || minor <= 0) {
			formError = 'Enter a positive limit.';
			return;
		}
		saving = true;
		try {
			await currentEngine().setBudget(month, categoryId, minor);
			limit = '';
			await load();
		} catch (e) {
			formError = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Budgets · Ledgerly</title></svelte:head>

<div class="mb-6 flex flex-wrap items-baseline justify-between gap-3">
	<h1 class="text-2xl font-semibold">Budgets</h1>
	<div class="flex items-center gap-2 text-sm">
		<input
			type="month"
			class="rounded-lg border border-line bg-surface px-3 py-2"
			bind:value={month}
			onchange={load}
		/>
		<span class="text-ink-soft">in {base}</span>
	</div>
</div>

{#if loading}
	<p class="text-sm text-ink-soft">Loading…</p>
{:else if error}
	<p class="text-sm text-negative">{error}</p>
{:else}
	<Card title={`Budget vs. actual · ${month}`}>
		{#if status && status.byCategory.length > 0}
			<ul class="space-y-4">
				{#each status.byCategory as row (row.categoryId)}
					{@const budget = budgets.find((b) => b.categoryId === row.categoryId)}
					{@const pct =
						budget && budget.limitMinor > 0
							? Math.min(100, (row.spentInBaseMinor / budget.limitMinor) * 100)
							: 0}
					<li>
						<div class="mb-1 flex items-baseline justify-between text-sm">
							<span>{categoryName(row.categoryId)}</span>
							<span class="text-ink-soft">
								<Money minor={row.spentInBaseMinor} currency={base} /> of
								<Money minor={row.limitMinor} currency={base} />
								<span
									class="ml-2 text-xs {row.pace === 'over'
										? 'text-negative'
										: row.pace === 'projected-over'
											? 'text-attention'
											: 'text-ink-soft'}">{paceLabel[row.pace]}</span
								>
							</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-line">
							<div
								class="h-full rounded-full {row.pace === 'over' ? 'bg-negative' : 'bg-accent'}"
								style={`width: ${pct}%`}
							></div>
						</div>
						<p class="mt-1 text-xs text-ink-soft">
							<Money minor={row.remainingMinor} currency={base} /> remaining
						</p>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-ink-soft">
				No budgets for {month} yet. Set a monthly limit per category below — spending converts to
				{base} with the rates from Settings.
			</p>
		{/if}
		{#if status && status.missingRates.length > 0}
			<p class="mt-3 text-xs text-attention">
				Missing rates: {status.missingRates.join(', ')} — those transactions were excluded.
			</p>
		{/if}
	</Card>

	<Card title="Set a budget" className="mt-4">
		<form class="grid gap-3 md:grid-cols-4" onsubmit={saveBudget}>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">Category</span>
				<select
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={categoryId}
				>
					<option value="">Choose…</option>
					{#each expenseCategories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</label>
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Monthly limit ({base})</span>
				<input
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={limit}
					placeholder="50,000"
					inputmode="decimal"
					required
				/>
			</label>
			<div class="self-end">
				<button
					class="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
					disabled={saving}>{saving ? 'Saving…' : 'Save budget'}</button
				>
			</div>
			{#if formError}
				<p class="text-sm text-negative md:col-span-4">{formError}</p>
			{/if}
		</form>
	</Card>
{/if}

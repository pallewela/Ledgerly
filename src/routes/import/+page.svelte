<script lang="ts">
	import { onMount } from 'svelte';
	import { currentEngine, initLedger } from '$lib/app/ledger';
	import { buildImportPlan, commitImport, parseCsv } from '$lib/import';
	import type { CsvColumnMapping, ImportPlan } from '$lib/import';
	import type { Account, ImportBatch } from '$lib/engine/types';
	import Card from '$lib/ui/Card.svelte';
	import Money from '$lib/ui/Money.svelte';

	let accounts = $state<Account[]>([]);
	let batches = $state<ImportBatch[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let accountId = $state('');
	let fileName = $state('');
	let headers = $state<string[]>([]);
	let rows = $state<Array<Record<string, string>>>([]);
	let mapping = $state({
		date: '',
		payee: '',
		amount: '',
		debit: '',
		credit: '',
		balance: '',
	});
	let dateFormat = $state<'auto' | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY'>('auto');
	let decimal = $state<'auto' | 'dot' | 'comma'>('auto');
	let skipDuplicates = $state(true);
	let plan = $state<ImportPlan | null>(null);
	let committing = $state(false);
	let message = $state<string | null>(null);

	const account = $derived(accounts.find((a) => a.id === accountId));
	const formatMoney = (minor: number) => (account ? { minor, currency: account.currency } : null);

	function autoMap(input: string[]): void {
		const normalized = input.map((h) => ({ raw: h, key: h.toLowerCase().replace(/[^a-z]/g, '') }));
		const find = (...candidates: string[]): string => {
			for (const candidate of candidates) {
				const hit = normalized.find((h) => h.key.includes(candidate));
				if (hit) return hit.raw;
			}
			return '';
		};
		mapping.date = find('date', 'posted', 'transactiondate');
		mapping.payee = find('payee', 'description', 'narration', 'details', 'merchant', 'reference');
		mapping.amount = find('amount', 'value', 'transactionamount');
		mapping.debit = find('debit', 'withdrawal', 'moneyout');
		mapping.credit = find('credit', 'deposit', 'moneyin');
		mapping.balance = find('balance');
		// A single "amount" column wins only when no debit/credit pair exists.
		if (mapping.debit || mapping.credit) mapping.amount = '';
	}

	async function loadBatches() {
		batches = await currentEngine().listImportBatches();
	}

	onMount(async () => {
		try {
			await initLedger();
			const engine = currentEngine();
			accounts = await engine.listAccounts();
			accountId = accounts[0]?.id ?? '';
			await loadBatches();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	async function chooseFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		error = null;
		plan = null;
		message = null;
		try {
			const parsed = parseCsv(await file.text());
			fileName = file.name;
			headers = parsed.headers;
			rows = parsed.rows;
			autoMap(headers);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function preview() {
		error = null;
		message = null;
		if (!account) {
			error = 'Choose the account this statement belongs to.';
			return;
		}
		if (!mapping.date || !mapping.payee || (!mapping.amount && !mapping.debit && !mapping.credit)) {
			error = 'Map the date, payee, and an amount (or debit/credit) column.';
			return;
		}
		try {
			const existing = await currentEngine().listTransactions({ accountIds: [accountId] });
			const columnMapping: CsvColumnMapping = {
				date: mapping.date,
				payee: mapping.payee,
				amount: mapping.amount || undefined,
				debit: mapping.debit || undefined,
				credit: mapping.credit || undefined,
				balance: mapping.balance || undefined,
				dateFormat,
				decimal,
			};
			plan = buildImportPlan({
				accountId,
				currency: account.currency,
				headers,
				rows,
				mapping: columnMapping,
				existingTransactions: existing,
			});
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function commit() {
		if (!plan) return;
		committing = true;
		error = null;
		try {
			const result = await commitImport({
				engine: currentEngine(),
				plan,
				skipDuplicates,
			});
			message = `Imported ${result.imported} transactions, skipped ${result.skipped}. You can undo below.`;
			plan = null;
			rows = [];
			headers = [];
			fileName = '';
			await loadBatches();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			committing = false;
		}
	}

	async function undo(batchId: string) {
		if (!confirm('Undo this import? All transactions it created are removed.')) return;
		await currentEngine().undoImportBatch(batchId);
		message = 'Import undone.';
		await loadBatches();
	}
</script>

<svelte:head><title>Import · Ledgerly</title></svelte:head>

<h1 class="mb-1 text-2xl font-semibold">Import a statement</h1>
<p class="mb-6 text-sm text-ink-soft">
	CSV for now — PDF statements and screenshots arrive in Stage 5. Every import is reviewed before
	anything is written to your ledger.
</p>

{#if loading}
	<p class="text-sm text-ink-soft">Loading…</p>
{:else}
	{#if error}
		<p class="mb-4 rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative" role="alert">
			{error}
		</p>
	{/if}
	{#if message}
		<p
			class="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent"
			role="status"
			aria-live="polite"
		>
			{message}
		</p>
	{/if}

	<Card title="1 · Choose the account and file">
		<div class="grid gap-3 md:grid-cols-3">
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Account</span>
				<select
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={accountId}
				>
					{#each accounts as option (option.id)}
						<option value={option.id}>{option.name} · {option.currency}</option>
					{/each}
				</select>
			</label>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">CSV file</span>
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-paper px-3 py-2"
				>
					<span class="rounded-md bg-accent-soft px-2 py-1 text-xs text-accent">Choose file</span>
					<span class="text-ink-soft">{fileName || 'No file chosen yet'}</span>
					<input type="file" accept=".csv,text/csv" class="hidden" onchange={chooseFile} />
				</label>
			</label>
		</div>
	</Card>

	{#if headers.length > 0}
		<Card title="2 · Map the columns" className="mt-4">
			<div class="grid gap-3 md:grid-cols-3">
				{#each [{ key: 'date', label: 'Date' }, { key: 'payee', label: 'Payee / description' }, { key: 'amount', label: 'Amount (signed)' }, { key: 'debit', label: 'Debit (money out)' }, { key: 'credit', label: 'Credit (money in)' }, { key: 'balance', label: 'Balance (optional)' }] as field (field.key)}
					<label class="text-sm">
						<span class="mb-1 block text-xs text-ink-soft">{field.label}</span>
						<select
							class="w-full rounded-lg border border-line bg-paper px-3 py-2"
							bind:value={mapping[field.key as keyof typeof mapping]}
						>
							<option value="">—</option>
							{#each headers as header (header)}
								<option value={header}>{header}</option>
							{/each}
						</select>
					</label>
				{/each}
				<label class="text-sm">
					<span class="mb-1 block text-xs text-ink-soft">Date format</span>
					<select
						class="w-full rounded-lg border border-line bg-paper px-3 py-2"
						bind:value={dateFormat}
					>
						<option value="auto">Detect automatically</option>
						<option value="YYYY-MM-DD">YYYY-MM-DD</option>
						<option value="DD/MM/YYYY">DD/MM/YYYY</option>
						<option value="MM/DD/YYYY">MM/DD/YYYY</option>
					</select>
				</label>
				<label class="text-sm">
					<span class="mb-1 block text-xs text-ink-soft">Decimal style</span>
					<select
						class="w-full rounded-lg border border-line bg-paper px-3 py-2"
						bind:value={decimal}
					>
						<option value="auto">Detect automatically</option>
						<option value="dot">1,234.56</option>
						<option value="comma">1.234,56</option>
					</select>
				</label>
			</div>
			<button class="mt-4 rounded-lg bg-accent px-4 py-2 text-sm text-white" onclick={preview}
				>Preview import</button
			>
		</Card>
	{/if}

	{#if plan}
		<Card title={`3 · Review · ${plan.summary.total} rows`} className="mt-4">
			<p class="mb-3 text-sm text-ink-soft">
				{plan.summary.valid} importable · {plan.summary.duplicates} already in the ledger ·
				{plan.summary.errors} with problems. Nothing is written until you confirm.
			</p>
			<div class="max-h-96 overflow-auto">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-surface text-left text-xs text-ink-soft">
						<tr>
							<th class="pb-2 font-medium">Date</th>
							<th class="pb-2 font-medium">Payee</th>
							<th class="pb-2 text-right font-medium">Amount</th>
							<th class="pb-2 font-medium">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each plan.rows as row (row.index)}
							<tr class="border-t border-line {row.issues.length > 0 ? 'text-ink-soft' : ''}">
								<td class="py-2">{row.date || '—'}</td>
								<td class="py-2">{row.payee || '—'}</td>
								<td class="py-2 text-right">
									{#if formatMoney(row.amountMinor)}
										<Money {...formatMoney(row.amountMinor)!} signed />
									{:else}
										—
									{/if}
								</td>
								<td class="py-2 text-xs">
									{#if row.issues.length > 0}
										<span class="text-negative">{row.issues.join(' · ')}</span>
									{:else if row.duplicateOf}
										<span class="text-attention">duplicate</span>
									{:else}
										<span class="text-positive">ready</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<label class="flex items-center gap-2 text-sm text-ink-soft">
					<input type="checkbox" bind:checked={skipDuplicates} />
					Skip duplicates
				</label>
				<button
					class="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
					disabled={committing || plan.summary.valid === 0}
					onclick={commit}
				>
					{committing
						? 'Importing…'
						: `Add ${plan.summary.valid - (skipDuplicates ? plan.summary.duplicates : 0)} transactions`}
				</button>
			</div>
		</Card>
	{/if}

	<Card title="Import history" className="mt-4">
		{#if batches.length === 0}
			<p class="text-sm text-ink-soft">No imports yet.</p>
		{:else}
			<ul class="space-y-2 text-sm">
				{#each batches as batch (batch.id)}
					<li class="flex items-baseline justify-between border-b border-line pb-2">
						<span>
							{batch.label}
							<span class="ml-2 text-xs text-ink-soft">
								{batch.rowsImported} added · {batch.rowsSkipped} skipped · {batch.createdAt.slice(
									0,
									10,
								)}
							</span>
						</span>
						<button class="text-xs text-ink-soft hover:text-negative" onclick={() => undo(batch.id)}
							>undo</button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
{/if}

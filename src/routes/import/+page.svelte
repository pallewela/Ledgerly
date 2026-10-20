<script lang="ts">
	import { onMount } from 'svelte';
	import { currentEngine, initLedger } from '$lib/app/ledger';
	import { SvelteSet } from 'svelte/reactivity';
	import { buildImportPlan, commitImport, mergeExtractedTables, parseCsv } from '$lib/import';
	import type { CsvColumnMapping, ImportPlan } from '$lib/import';
	import type { ExtractedTable } from '$lib/import/statement';
	import type { Account, ImportBatch } from '$lib/engine/types';
	import Card from '$lib/ui/Card.svelte';
	import Money from '$lib/ui/Money.svelte';

	type SourceKind = 'csv' | 'pdf' | 'image';

	let accounts = $state<Account[]>([]);
	let batches = $state<ImportBatch[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let accountId = $state('');
	let files = $state<File[]>([]);
	let sourceKind = $state<SourceKind | null>(null);
	let extracting = $state(false);
	let progress = $state('');
	let extractedNote = $state('');

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
	const excluded = new SvelteSet<number>();
	let committing = $state(false);
	let message = $state<string | null>(null);

	const account = $derived(accounts.find((a) => a.id === accountId));

	function kindOf(file: File): SourceKind | 'other' {
		const name = file.name.toLowerCase();
		if (name.endsWith('.csv') || file.type === 'text/csv') return 'csv';
		if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
		if (file.type.startsWith('image/')) return 'image';
		return 'other';
	}

	function resetPlan() {
		plan = null;
		excluded.clear();
		extractedNote = '';
		message = null;
	}

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

	async function chooseFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const selected = [...(input.files ?? [])];
		input.value = '';
		if (selected.length === 0) return;

		resetPlan();
		error = null;
		files = [];
		headers = [];

		const kinds = new Set(selected.map(kindOf));
		if (kinds.has('other')) {
			error = 'Choose CSV, PDF, or PNG/JPEG screenshots.';
			return;
		}
		if (kinds.size > 1) {
			error = 'Import one kind at a time — CSVs, PDFs, or screenshots.';
			return;
		}

		const kind = [...kinds][0] as SourceKind;
		sourceKind = kind;
		files = selected;

		if (kind === 'csv') {
			if (selected.length > 1) {
				error = 'CSV import takes one file at a time.';
				return;
			}
			try {
				const parsed = parseCsv(await selected[0].text());
				headers = parsed.headers;
				rows = parsed.rows;
				autoMap(headers);
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
			}
			return;
		}

		await extractFromFiles();
	}

	async function extractFromFiles() {
		if (!account || !sourceKind || files.length === 0) return;
		extracting = true;
		error = null;
		progress = files.length > 1 ? `Preparing ${files.length} files…` : 'Preparing…';
		try {
			const engine = currentEngine();
			const existing = await engine.listTransactions({ accountIds: [accountId] });
			let table: ExtractedTable;

			if (sourceKind === 'pdf') {
				const { extractPdfTable } = await import('$lib/import/pdf');
				const tables: ExtractedTable[] = [];
				for (const file of files) {
					tables.push(
						await extractPdfTable(file, {
							currency: account.currency,
							onProgress: (text) => (progress = `${file.name}: ${text}`),
						}),
					);
				}
				table = mergeExtractedTables(tables);
			} else {
				const { extractImageTable } = await import('$lib/import/ocr');
				table = await extractImageTable(files, {
					currency: account.currency,
					onProgress: (text) => (progress = text),
				});
			}

			if (table.rows.length === 0) {
				error =
					sourceKind === 'pdf'
						? 'No transaction rows found. If this PDF is scanned (no text layer), upload screenshots instead.'
						: 'No transaction rows found. Try a clearer screenshot of the transaction list.';
				return;
			}

			plan = buildImportPlan({
				accountId,
				currency: account.currency,
				headers: table.headers,
				rows: table.rows,
				mapping: {
					date: 'Date',
					payee: 'Description',
					amount: 'Amount',
					balance: 'Balance',
					dateFormat: 'YYYY-MM-DD',
					decimal: 'auto',
				},
				existingTransactions: existing,
			});
			extractedNote = `${table.rows.length} transaction rows from ${files.length} file${
				files.length > 1 ? 's' : ''
			} · ${table.meta.skipped} non-transaction lines skipped.`;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			extracting = false;
			progress = '';
		}
	}

	async function previewCsv() {
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

	function toggleRow(index: number) {
		if (excluded.has(index)) excluded.delete(index);
		else excluded.add(index);
	}

	const includedRows = $derived(plan ? plan.rows.filter((row) => !excluded.has(row.index)) : []);
	const importCount = $derived(
		includedRows.filter(
			(row) => row.issues.length === 0 && (!skipDuplicates || row.duplicateOf === null),
		).length,
	);

	async function commit() {
		if (!plan) return;
		committing = true;
		error = null;
		try {
			const filteredPlan: ImportPlan = { ...plan, rows: includedRows };
			const result = await commitImport({
				engine: currentEngine(),
				plan: filteredPlan,
				skipDuplicates,
			});
			message = `Imported ${result.imported} transactions, skipped ${result.skipped}. You can undo below.`;
			plan = null;
			files = [];
			sourceKind = null;
			headers = [];
			rows = [];
			excluded.clear();
			extractedNote = '';
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

	function resetAll() {
		resetPlan();
		files = [];
		sourceKind = null;
		headers = [];
		rows = [];
	}
</script>

<svelte:head><title>Import · Ledgerly</title></svelte:head>

<h1 class="mb-1 text-2xl font-semibold">Import a statement</h1>
<p class="mb-6 text-sm text-ink-soft">
	CSV, PDF statements, or screenshots of your banking app. PDF text and OCR are read
	<strong class="text-ink">on this device</strong> — nothing is uploaded. Every import is reviewed before
	anything reaches your ledger.
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

	<Card title="1 · Choose the account and files">
		<div class="grid gap-3 md:grid-cols-3">
			<label class="text-sm">
				<span class="mb-1 block text-xs text-ink-soft">Account</span>
				<select
					class="w-full rounded-lg border border-line bg-paper px-3 py-2"
					bind:value={accountId}
					onchange={resetAll}
				>
					{#each accounts as option (option.id)}
						<option value={option.id}>{option.name} · {option.currency}</option>
					{/each}
				</select>
			</label>
			<label class="text-sm md:col-span-2">
				<span class="mb-1 block text-xs text-ink-soft">CSV, PDF, or screenshots</span>
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-paper px-3 py-2"
				>
					<span class="rounded-md bg-accent-soft px-2 py-1 text-xs text-accent">Choose files</span>
					<span class="text-ink-soft">
						{files.length > 0
							? `${files.length} file${files.length > 1 ? 's' : ''} selected`
							: 'No files chosen yet'}
					</span>
					<input
						type="file"
						multiple
						accept=".csv,.pdf,image/png,image/jpeg,image/webp,text/csv,application/pdf"
						class="hidden"
						onchange={chooseFiles}
					/>
				</label>
				<p class="mt-1 text-xs text-ink-soft">
					PDFs need a text layer. Scanned PDFs → upload screenshots instead. First OCR run downloads
					the English model (~4&nbsp;MB), then works offline.
				</p>
			</label>
		</div>
		{#if extracting}
			<p class="mt-3 text-sm text-ink-soft" role="status" aria-live="polite">
				{progress || 'Working…'}
			</p>
		{/if}
	</Card>

	{#if sourceKind === 'csv' && headers.length > 0}
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
			<button class="mt-4 rounded-lg bg-accent px-4 py-2 text-sm text-white" onclick={previewCsv}
				>Preview import</button
			>
		</Card>
	{/if}

	{#if plan}
		<Card
			title={`${sourceKind === 'csv' ? '3' : '2'} · Review · ${plan.summary.total} rows`}
			className="mt-4"
		>
			{#if extractedNote}
				<p class="mb-2 text-sm text-ink-soft">{extractedNote}</p>
			{/if}
			<p class="mb-3 text-sm text-ink-soft">
				{plan.summary.valid} importable · {plan.summary.duplicates} already in the ledger ·
				{plan.summary.errors} with problems. Uncheck anything the parser misread.
			</p>
			<div class="max-h-96 overflow-auto">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-surface text-left text-xs text-ink-soft">
						<tr>
							<th class="pb-2 font-medium">Import</th>
							<th class="pb-2 font-medium">Date</th>
							<th class="pb-2 font-medium">Payee</th>
							<th class="pb-2 text-right font-medium">Amount</th>
							<th class="pb-2 font-medium">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each plan.rows as row (row.index)}
							<tr
								class="border-t border-line {row.issues.length > 0 || excluded.has(row.index)
									? 'text-ink-soft'
									: ''}"
							>
								<td class="py-2">
									<input
										type="checkbox"
										checked={!excluded.has(row.index)}
										disabled={row.issues.length > 0}
										onchange={() => toggleRow(row.index)}
										aria-label={`Import ${row.payee || 'row'} on ${row.date || 'unknown date'}`}
									/>
								</td>
								<td class="py-2">{row.date || '—'}</td>
								<td class="py-2">
									<input
										class="w-full rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-line focus:border-line focus:bg-paper"
										bind:value={row.payee}
										aria-label="Payee"
										placeholder="Payee"
									/>
								</td>
								<td class="py-2 text-right">
									<Money minor={row.amountMinor} currency={account?.currency ?? 'LKR'} signed />
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
					disabled={committing || importCount === 0}
					onclick={commit}
				>
					{committing ? 'Importing…' : `Add ${importCount} transactions`}
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

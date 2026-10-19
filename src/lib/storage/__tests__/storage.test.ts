import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { LedgerRepository } from '../../engine/repository';
import type {
	Account,
	Bill,
	Budget,
	Category,
	ImportBatch,
	Rule,
	Split,
	Transaction,
} from '../../engine/types';
import { newId } from '../../engine/util';
import { IndexedDbRepository, createIndexedDbRepository } from '../indexeddb-repository';
import { exportSnapshot, restoreSnapshot } from '../snapshot';

const NOW = '2026-10-19T00:00:00.000Z';

const openDbs: Array<{ name: string; repo: IndexedDbRepository }> = [];

/** Fresh, uniquely named database; torn down in afterEach. */
function openRepo(): { name: string; repo: IndexedDbRepository } {
	const name = `ledgerly-test-${crypto.randomUUID()}`;
	const repo = createIndexedDbRepository(name) as IndexedDbRepository;
	const entry = { name, repo };
	openDbs.push(entry);
	return entry;
}

afterEach(async () => {
	for (const { name, repo } of openDbs.splice(0)) {
		repo.close();
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(name);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
			request.onblocked = () => reject(new Error(`deleteDatabase blocked for ${name}`));
		});
	}
});

// ---------------------------------------------------------------- fixtures

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: newId(),
		name: 'Day-to-day',
		institution: null,
		type: 'checking',
		currency: 'LKR',
		openingBalanceMinor: 250_000,
		includeInNetWorth: true,
		archivedAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: newId(),
		accountId: 'a1',
		date: '2026-10-01',
		payee: 'Keells Super',
		amountMinor: -4_350,
		categoryId: null,
		note: null,
		tags: [],
		transferId: null,
		importBatchId: null,
		source: 'manual',
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function makeCategory(overrides: Partial<Category> = {}): Category {
	return {
		id: newId(),
		name: 'Groceries',
		parentId: null,
		kind: 'expense',
		archivedAt: null,
		sortOrder: 0,
		...overrides,
	};
}

function makeSplit(overrides: Partial<Split> = {}): Split {
	return {
		id: newId(),
		transactionId: 't1',
		categoryId: 'c1',
		amountMinor: -2_000,
		note: null,
		...overrides,
	};
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
	return {
		id: newId(),
		priority: 0,
		match: { payeeContains: 'keells' },
		action: { categoryId: 'c1' },
		enabled: true,
		createdAt: NOW,
		...overrides,
	};
}

function makeBudget(overrides: Partial<Budget> = {}): Budget {
	return {
		id: newId(),
		month: '2026-10',
		categoryId: 'c1',
		limitMinor: 50_000,
		rollover: false,
		...overrides,
	};
}

function makeBill(overrides: Partial<Bill> = {}): Bill {
	return {
		id: newId(),
		name: 'Mobile',
		amountMinor: 3_500,
		dueDay: 12,
		accountId: 'a1',
		archivedAt: null,
		lastPaidAt: null,
		...overrides,
	};
}

function makeImportBatch(overrides: Partial<ImportBatch> = {}): ImportBatch {
	return {
		id: newId(),
		createdAt: NOW,
		source: 'csv',
		label: 'October CSV',
		accountId: 'a1',
		rowsTotal: 10,
		rowsImported: 9,
		rowsSkipped: 1,
		...overrides,
	};
}

function sortedById<T extends { id: string }>(rows: T[]): T[] {
	return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedByKey<T extends { key: string }>(rows: T[]): T[] {
	return [...rows].sort((a, b) => a.key.localeCompare(b.key));
}

// ------------------------------------------------------------------- tests

describe('indexeddb repository — accounts and transactions', () => {
	it('round-trips accounts and transactions with upsert semantics', async () => {
		const { repo } = openRepo();
		const account = makeAccount();
		await repo.putAccount(account);
		expect(await repo.getAccount(account.id)).toEqual(account);
		expect(await repo.listAccounts()).toEqual([account]);

		const tx = makeTransaction({ accountId: account.id, tags: ['home'] });
		await repo.putTransaction(tx);
		expect(await repo.getTransaction(tx.id)).toEqual(tx);

		await repo.putTransaction({ ...tx, amountMinor: -9_999 });
		const rows = await repo.listTransactions();
		expect(rows.length).toBe(1);
		expect(rows[0].amountMinor).toBe(-9_999);

		await repo.deleteTransaction(tx.id);
		expect(await repo.getTransaction(tx.id)).toBeUndefined();
	});

	it('hides archived accounts unless includeArchived is set', async () => {
		const { repo } = openRepo();
		const active = makeAccount({ name: 'Active' });
		const archived = makeAccount({ name: 'Archived', archivedAt: NOW });
		await repo.putAccount(active);
		await repo.putAccount(archived);

		expect((await repo.listAccounts()).map((a) => a.id)).toEqual([active.id]);
		expect((await repo.listAccounts(true)).map((a) => a.id).sort()).toEqual(
			[active.id, archived.id].sort(),
		);
	});
});

describe('indexeddb repository — transaction filters and sorting', () => {
	async function seed(repo: LedgerRepository): Promise<Record<string, Transaction>> {
		const rows = {
			t1: makeTransaction({
				id: 't1',
				accountId: 'a1',
				date: '2026-10-01',
				payee: 'Keells Super',
				amountMinor: -4_350,
				categoryId: 'c1',
				createdAt: '2026-10-01T09:00:00.000Z',
			}),
			t2: makeTransaction({
				id: 't2',
				accountId: 'a1',
				date: '2026-10-05',
				payee: 'Cargills',
				amountMinor: -1_200,
				categoryId: null,
				createdAt: '2026-10-05T09:00:00.000Z',
			}),
			t3: makeTransaction({
				id: 't3',
				accountId: 'a2',
				date: '2026-10-10',
				payee: 'Keells Junction',
				amountMinor: -900,
				categoryId: 'c2',
				transferId: 'tr1',
				createdAt: '2026-10-10T09:00:00.000Z',
			}),
			t4: makeTransaction({
				id: 't4',
				accountId: 'a2',
				date: '2026-10-15',
				payee: 'Salary',
				amountMinor: 500_000,
				categoryId: 'c1',
				createdAt: '2026-10-15T09:00:00.000Z',
			}),
		};
		for (const tx of Object.values(rows)) await repo.putTransaction(tx);
		return rows;
	}

	it('filters by date range, account, payee, category, transfer flag and amount', async () => {
		const { repo } = openRepo();
		await seed(repo);

		expect(
			(await repo.listTransactions({ from: '2026-10-05', to: '2026-10-10' })).map((t) => t.id),
		).toEqual(['t3', 't2']);
		expect((await repo.listTransactions({ accountIds: ['a1'] })).map((t) => t.id)).toEqual([
			't2',
			't1',
		]);
		expect((await repo.listTransactions({ payeeContains: 'keells' })).map((t) => t.id)).toEqual([
			't3',
			't1',
		]);
		expect((await repo.listTransactions({ categoryId: null })).map((t) => t.id)).toEqual(['t2']);
		expect((await repo.listTransactions({ categoryId: 'c1' })).map((t) => t.id)).toEqual([
			't4',
			't1',
		]);
		expect((await repo.listTransactions({ hasTransfer: true })).map((t) => t.id)).toEqual(['t3']);
		expect((await repo.listTransactions({ hasTransfer: false })).map((t) => t.id)).toEqual([
			't4',
			't2',
			't1',
		]);
		expect(
			(await repo.listTransactions({ minAmountMinor: -1_200, maxAmountMinor: -900 })).map(
				(t) => t.id,
			),
		).toEqual(['t3', 't2']);
	});

	it('sorts date DESC then createdAt DESC and applies limit after sorting', async () => {
		const { repo } = openRepo();
		await seed(repo);
		await repo.putTransaction(
			makeTransaction({
				id: 't5',
				accountId: 'a1',
				date: '2026-10-15',
				payee: 'Same-day later entry',
				createdAt: '2026-10-15T18:00:00.000Z',
			}),
		);

		expect((await repo.listTransactions()).map((t) => t.id)).toEqual([
			't5',
			't4',
			't3',
			't2',
			't1',
		]);
		expect((await repo.listTransactions({ limit: 2 })).map((t) => t.id)).toEqual(['t5', 't4']);
		expect((await repo.listTransactions({ limit: 0 })).length).toBe(0);
	});
});

describe('indexeddb repository — splits', () => {
	it('stores splits per transaction and deletes them in bulk', async () => {
		const { repo } = openRepo();
		const shop = makeSplit({ id: 's1', transactionId: 't1', amountMinor: -2_000 });
		const fuel = makeSplit({
			id: 's2',
			transactionId: 't1',
			amountMinor: -2_350,
			categoryId: 'c2',
		});
		const other = makeSplit({ id: 's3', transactionId: 't2', amountMinor: -1_200 });
		for (const split of [shop, fuel, other]) await repo.putSplit(split);

		expect(sortedById(await repo.listSplitsForTransaction('t1'))).toEqual([shop, fuel]);
		expect((await repo.listAllSplits()).length).toBe(3);

		await repo.deleteSplitsForTransaction('t1');
		expect(await repo.listSplitsForTransaction('t1')).toEqual([]);
		expect(await repo.listSplitsForTransaction('t2')).toEqual([other]);
		expect((await repo.listAllSplits()).length).toBe(1);
	});
});

describe('indexeddb repository — categories, rules, budgets, bills, import batches', () => {
	it('orders categories by sortOrder then name and hides archived ones', async () => {
		const { repo } = openRepo();
		await repo.putCategory(makeCategory({ id: 'c1', name: 'Zeta', sortOrder: 1 }));
		await repo.putCategory(makeCategory({ id: 'c2', name: 'Alpha', sortOrder: 1 }));
		await repo.putCategory(makeCategory({ id: 'c3', name: 'First', sortOrder: 0 }));
		await repo.putCategory(
			makeCategory({ id: 'c4', name: 'Archived', sortOrder: 2, archivedAt: NOW }),
		);

		expect((await repo.listCategories()).map((c) => c.id)).toEqual(['c3', 'c2', 'c1']);
		expect((await repo.listCategories(true)).map((c) => c.id)).toEqual(['c3', 'c2', 'c1', 'c4']);
	});

	it('orders rules by priority then createdAt', async () => {
		const { repo } = openRepo();
		await repo.putRule(makeRule({ id: 'r1', priority: 2, createdAt: '2026-10-01T00:00:00.000Z' }));
		await repo.putRule(makeRule({ id: 'r2', priority: 1, createdAt: '2026-10-05T00:00:00.000Z' }));
		await repo.putRule(makeRule({ id: 'r3', priority: 1, createdAt: '2026-10-02T00:00:00.000Z' }));

		expect((await repo.listRules()).map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
	});

	it('filters budgets by month and returns all when month is omitted', async () => {
		const { repo } = openRepo();
		await repo.putBudget(makeBudget({ id: 'b1', month: '2026-10' }));
		await repo.putBudget(makeBudget({ id: 'b2', month: '2026-11' }));
		await repo.putBudget(makeBudget({ id: 'b3', month: '2026-10' }));

		expect(sortedById(await repo.listBudgets('2026-10')).map((b) => b.id)).toEqual(['b1', 'b3']);
		expect((await repo.listBudgets()).length).toBe(3);
	});

	it('hides archived bills unless includeArchived is set', async () => {
		const { repo } = openRepo();
		await repo.putBill(makeBill({ id: 'bill1' }));
		await repo.putBill(makeBill({ id: 'bill2', archivedAt: NOW }));

		expect((await repo.listBills()).map((b) => b.id)).toEqual(['bill1']);
		expect((await repo.listBills(true)).map((b) => b.id).sort()).toEqual(['bill1', 'bill2']);
	});

	it('orders import batches by createdAt DESC', async () => {
		const { repo } = openRepo();
		await repo.putImportBatch(
			makeImportBatch({ id: 'batch1', createdAt: '2026-10-01T00:00:00.000Z' }),
		);
		await repo.putImportBatch(
			makeImportBatch({ id: 'batch2', createdAt: '2026-10-10T00:00:00.000Z' }),
		);
		await repo.putImportBatch(
			makeImportBatch({ id: 'batch3', createdAt: '2026-10-05T00:00:00.000Z' }),
		);

		expect((await repo.listImportBatches()).map((b) => b.id)).toEqual([
			'batch2',
			'batch3',
			'batch1',
		]);
	});
});

describe('indexeddb repository — settings and clear', () => {
	it('gets, puts, lists and deletes settings', async () => {
		const { repo } = openRepo();
		expect(await repo.getSetting('baseCurrency')).toBeUndefined();

		await repo.putSetting('baseCurrency', 'LKR');
		await repo.putSetting('fx', { base: 'LKR', asOf: '2026-10-19', rates: { USD: 300 } });
		expect(await repo.getSetting<string>('baseCurrency')).toBe('LKR');
		expect(await repo.getSetting<{ base: string }>('fx')).toEqual({
			base: 'LKR',
			asOf: '2026-10-19',
			rates: { USD: 300 },
		});

		const all = await repo.listSettings();
		expect(all.length).toBe(2);
		expect(all.map((s) => s.key).sort()).toEqual(['baseCurrency', 'fx']);

		await repo.putSetting('baseCurrency', 'USD');
		expect(await repo.getSetting('baseCurrency')).toBe('USD');
		expect((await repo.listSettings()).length).toBe(2);

		await repo.deleteSetting('baseCurrency');
		expect(await repo.getSetting('baseCurrency')).toBeUndefined();
		expect((await repo.listSettings()).map((s) => s.key)).toEqual(['fx']);
	});

	it('clear() wipes every table', async () => {
		const { repo } = openRepo();
		await repo.putAccount(makeAccount());
		await repo.putBalanceSnapshot({
			id: 'snap1',
			accountId: 'a1',
			date: '2026-10-01',
			balanceMinor: 100_000,
			note: null,
			createdAt: NOW,
		});
		await repo.putTransaction(makeTransaction());
		await repo.putSplit(makeSplit());
		await repo.putCategory(makeCategory());
		await repo.putRule(makeRule());
		await repo.putPayeeMemory({
			key: 'KEELLS|a1',
			payee: 'Keells',
			accountId: 'a1',
			categoryId: 'c1',
			useCount: 3,
			lastUsedAt: NOW,
		});
		await repo.putBudget(makeBudget());
		await repo.putBill(makeBill());
		await repo.putImportBatch(makeImportBatch());
		await repo.putSetting('baseCurrency', 'LKR');

		await repo.clear();

		expect(await repo.listAccounts(true)).toEqual([]);
		expect(await repo.listBalanceSnapshots()).toEqual([]);
		expect(await repo.listTransactions()).toEqual([]);
		expect(await repo.listAllSplits()).toEqual([]);
		expect(await repo.listCategories(true)).toEqual([]);
		expect(await repo.listRules()).toEqual([]);
		expect(await repo.listPayeeMemory()).toEqual([]);
		expect(await repo.listBudgets()).toEqual([]);
		expect(await repo.listBills(true)).toEqual([]);
		expect(await repo.listImportBatches()).toEqual([]);
		expect(await repo.listSettings()).toEqual([]);
	});
});

/** Populate one row of every entity type so snapshot tests cover all tables. */
async function seedEverything(repo: LedgerRepository): Promise<void> {
	await repo.putAccount(makeAccount({ id: 'acct-1', name: 'Day-to-day' }));
	await repo.putAccount(makeAccount({ id: 'acct-2', name: 'Archived', archivedAt: NOW }));
	await repo.putBalanceSnapshot({
		id: 'snap-1',
		accountId: 'acct-1',
		date: '2026-10-01',
		balanceMinor: 900_000,
		note: 'Opening check',
		createdAt: NOW,
	});
	await repo.putTransaction(
		makeTransaction({ id: 'tx-1', accountId: 'acct-1', categoryId: 'cat-1', tags: ['home'] }),
	);
	await repo.putTransaction(
		makeTransaction({ id: 'tx-2', accountId: 'acct-2', date: '2026-10-02' }),
	);
	await repo.putSplit(makeSplit({ id: 'split-1', transactionId: 'tx-1' }));
	await repo.putCategory(makeCategory({ id: 'cat-1', sortOrder: 1 }));
	await repo.putCategory(makeCategory({ id: 'cat-2', name: 'Archived', archivedAt: NOW }));
	await repo.putRule(makeRule({ id: 'rule-1' }));
	await repo.putPayeeMemory({
		key: 'KEELLS|acct-1',
		payee: 'Keells',
		accountId: 'acct-1',
		categoryId: 'cat-1',
		useCount: 4,
		lastUsedAt: NOW,
	});
	await repo.putBudget(makeBudget({ id: 'budget-1' }));
	await repo.putBill(makeBill({ id: 'bill-1' }));
	await repo.putBill(makeBill({ id: 'bill-2', archivedAt: NOW }));
	await repo.putImportBatch(makeImportBatch({ id: 'batch-1' }));
	await repo.putSetting('baseCurrency', 'LKR');
	await repo.putSetting('fx', { base: 'LKR', asOf: '2026-10-19', rates: { USD: 300 } });
}

describe('indexeddb repository — snapshots', () => {
	it('exports every table and restores an identical copy into a fresh database', async () => {
		const source = openRepo().repo;
		await seedEverything(source);
		const snapshot = await exportSnapshot(source);

		expect(snapshot.version).toBe(1);
		expect(Number.isNaN(Date.parse(snapshot.exportedAt))).toBe(false);
		expect(snapshot.accounts.length).toBe(2);
		expect(snapshot.balanceSnapshots.length).toBe(1);
		expect(snapshot.transactions.length).toBe(2);
		expect(snapshot.splits.length).toBe(1);
		expect(snapshot.categories.length).toBe(2);
		expect(snapshot.rules.length).toBe(1);
		expect(snapshot.payeeMemory.length).toBe(1);
		expect(snapshot.budgets.length).toBe(1);
		expect(snapshot.bills.length).toBe(2);
		expect(snapshot.importBatches.length).toBe(1);
		expect(snapshot.settings.length).toBe(2);

		const target = openRepo().repo;
		await restoreSnapshot(target, snapshot);
		const restored = await exportSnapshot(target);

		expect(sortedById(restored.accounts)).toEqual(sortedById(snapshot.accounts));
		expect(sortedById(restored.balanceSnapshots)).toEqual(sortedById(snapshot.balanceSnapshots));
		expect(sortedById(restored.transactions)).toEqual(sortedById(snapshot.transactions));
		expect(sortedById(restored.splits)).toEqual(sortedById(snapshot.splits));
		expect(sortedById(restored.categories)).toEqual(sortedById(snapshot.categories));
		expect(sortedById(restored.rules)).toEqual(sortedById(snapshot.rules));
		expect(sortedByKey(restored.payeeMemory)).toEqual(sortedByKey(snapshot.payeeMemory));
		expect(sortedById(restored.budgets)).toEqual(sortedById(snapshot.budgets));
		expect(sortedById(restored.bills)).toEqual(sortedById(snapshot.bills));
		expect(sortedById(restored.importBatches)).toEqual(sortedById(snapshot.importBatches));
		expect([...restored.settings].sort((a, b) => a.key.localeCompare(b.key))).toEqual(
			[...snapshot.settings].sort((a, b) => a.key.localeCompare(b.key)),
		);
	});

	it('merge restores without deleting existing rows; replace clears first', async () => {
		const source = openRepo().repo;
		await source.putAccount(makeAccount({ id: 'incoming', name: 'From backup' }));
		const snapshot = await exportSnapshot(source);

		const target = openRepo().repo;
		await target.putAccount(makeAccount({ id: 'existing', name: 'Already here' }));

		await restoreSnapshot(target, snapshot, 'merge');
		expect((await target.listAccounts(true)).map((a) => a.id).sort()).toEqual([
			'existing',
			'incoming',
		]);

		await restoreSnapshot(target, snapshot, 'replace');
		expect((await target.listAccounts(true)).map((a) => a.id)).toEqual(['incoming']);
	});

	it('rejects unsupported versions and missing arrays before touching data', async () => {
		const { repo } = openRepo();
		await repo.putAccount(makeAccount({ id: 'keep-me' }));

		const valid = await exportSnapshot(repo);
		await expect(
			restoreSnapshot(repo, { ...valid, version: 2 } as unknown as typeof valid),
		).rejects.toThrow(/Unsupported ledger snapshot version/);
		await expect(
			restoreSnapshot(repo, { ...valid, transactions: undefined } as unknown as typeof valid),
		).rejects.toThrow(/"transactions" must be an array/);

		expect((await repo.listAccounts(true)).map((a) => a.id)).toEqual(['keep-me']);
	});
});

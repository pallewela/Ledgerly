import { describe, expect, it } from 'vitest';
import { createEngine, seedDefaultCategories } from '../engine';
import { MemoryRepository } from '../memory-repository';
import type { EngineApi } from '../api';
import type { Category, FxRateTable } from '../types';

/**
 * Engine behaviour tests (PLAN §8): ledger invariants, balances, transfers,
 * splits, rules, payee memory, budgets, bills, FX reports, import undo.
 * Every test runs against MemoryRepository with a frozen clock.
 */

const CLOCK = () => new Date('2026-10-19T12:00:00'); // local noon → day 19

const FX: FxRateTable = {
	base: 'LKR',
	asOf: '2026-10-19',
	rates: { USD: 300, AUD: 195 },
};

interface Book {
	repo: MemoryRepository;
	engine: EngineApi;
	cats: Record<'salary' | 'groceries' | 'eating' | 'savings', Category>;
}

async function makeBook(): Promise<Book> {
	const repo = new MemoryRepository();
	const engine = createEngine(repo, CLOCK);
	const salary = await engine.createCategory({ name: 'Salary', kind: 'income' });
	const groceries = await engine.createCategory({ name: 'Groceries', kind: 'expense' });
	const eating = await engine.createCategory({ name: 'Eating out', kind: 'expense' });
	const savings = await engine.createCategory({ name: 'Savings', kind: 'savings' });
	return { repo, engine, cats: { salary, groceries, eating, savings } };
}

async function account(
	engine: EngineApi,
	overrides: Partial<Parameters<EngineApi['createAccount']>[0]> = {},
) {
	return engine.createAccount({
		name: 'Day-to-day',
		type: 'checking',
		currency: 'LKR',
		openingBalanceMinor: 100_000,
		...overrides,
	});
}

describe('accounts & balances', () => {
	it('creates accounts and validates currency codes', async () => {
		const { engine } = await makeBook();
		const acc = await account(engine);
		expect(acc.currency).toBe('LKR');
		expect(acc.openingBalanceMinor).toBe(100_000);
		expect((await engine.listAccounts()).length).toBe(1);

		await expect(account(engine, { currency: 'usd' })).rejects.toThrow(/3-letter ISO/);
	});

	it('computes opening balance + transactions, anchored to the latest snapshot', async () => {
		const { engine } = await makeBook();
		const acc = await account(engine); // 100,000

		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-05',
			payee: 'Keells',
			amountMinor: -25_000,
		});
		expect(await engine.computeBalance(acc.id, '2026-10-09')).toBe(75_000);

		// Statement snapshot says 60,000 at end of Oct 10.
		await engine.recordBalanceSnapshot(acc.id, '2026-10-10', 60_000);

		// A transaction ON the snapshot date is considered already included.
		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-10',
			payee: 'Cargills',
			amountMinor: -5_000,
		});
		expect(await engine.computeBalance(acc.id, '2026-10-10')).toBe(60_000);

		// Later transactions move the anchored balance.
		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-12',
			payee: 'Uber',
			amountMinor: -1_000,
		});
		expect(await engine.computeBalance(acc.id, '2026-10-12')).toBe(59_000);
		// Before the snapshot, history still resolves from the opening balance.
		expect(await engine.computeBalance(acc.id, '2026-10-09')).toBe(75_000);
	});

	it('rejects currency changes once transactions exist', async () => {
		const { engine } = await makeBook();
		const acc = await account(engine);
		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-01',
			payee: 'Rent',
			amountMinor: -50_000,
		});
		await expect(engine.updateAccount(acc.id, { currency: 'USD' })).rejects.toThrow(
			/cannot change currency/,
		);
	});

	it('validates amounts and payees', async () => {
		const { engine } = await makeBook();
		const acc = await account(engine);
		await expect(
			engine.addTransaction({
				accountId: acc.id,
				date: '2026-10-01',
				payee: 'X',
				amountMinor: 10.5,
			}),
		).rejects.toThrow(/integer/);
		await expect(
			engine.addTransaction({ accountId: acc.id, date: '2026-10-01', payee: 'X', amountMinor: 0 }),
		).rejects.toThrow(/zero/);
		await expect(
			engine.addTransaction({
				accountId: acc.id,
				date: '2026-10-01',
				payee: '  ',
				amountMinor: 100,
			}),
		).rejects.toThrow(/payee/);
	});
});

describe('transfers', () => {
	it('creates two linked legs and deletes them together', async () => {
		const { engine } = await makeBook();
		const a = await account(engine, { name: 'Bank' });
		const b = await account(engine, { name: 'Savings', type: 'savings', openingBalanceMinor: 0 });

		const legA = await engine.addTransaction({
			accountId: a.id,
			date: '2026-10-15',
			payee: 'Move to savings',
			amountMinor: -20_000,
			transferToAccountId: b.id,
		});
		expect(legA.transferId).toBeTruthy();

		const legs = (await engine.listTransactions()).filter((t) => t.transferId === legA.transferId);
		expect(legs.length).toBe(2);
		expect(legs.map((l) => l.amountMinor).sort((x, y) => x - y)).toEqual([-20_000, 20_000]);

		expect(await engine.computeBalance(a.id, '2026-10-19')).toBe(80_000);
		expect(await engine.computeBalance(b.id, '2026-10-19')).toBe(20_000);

		await engine.deleteTransaction(legA.id);
		expect(await engine.listTransactions()).toHaveLength(0);
	});

	it('refuses cross-currency transfers (Q-B22 deferred)', async () => {
		const { engine } = await makeBook();
		const lkr = await account(engine);
		const usd = await account(engine, { name: 'USD card', currency: 'USD', type: 'credit_card' });
		await expect(
			engine.addTransaction({
				accountId: lkr.id,
				date: '2026-10-15',
				payee: 'Pay card',
				amountMinor: -10_000,
				transferToAccountId: usd.id,
			}),
		).rejects.toThrow(/cross-currency/);
	});

	it('suggests and pairs two existing legs, then unpairs', async () => {
		const { engine } = await makeBook();
		const a = await account(engine, { name: 'Bank' });
		const b = await account(engine, { name: 'Card', type: 'credit_card', openingBalanceMinor: 0 });

		const out = await engine.addTransaction({
			accountId: a.id,
			date: '2026-10-05',
			payee: 'Card payment',
			amountMinor: -5_000,
		});
		const inn = await engine.addTransaction({
			accountId: b.id,
			date: '2026-10-06',
			payee: 'Payment received',
			amountMinor: 5_000,
		});

		const pairs = await engine.suggestTransferPairs({ windowDays: 3 });
		expect(pairs).toHaveLength(1);
		expect(new Set([pairs[0].a.id, pairs[0].b.id])).toEqual(new Set([out.id, inn.id]));

		const transferId = await engine.pairAsTransfer(out.id, inn.id);
		expect((await engine.getTransaction(out.id))?.transferId).toBe(transferId);
		expect((await engine.getTransaction(out.id))?.categoryId).toBeNull();

		await engine.unpairTransfer(transferId);
		expect((await engine.getTransaction(out.id))?.transferId).toBeNull();
		expect((await engine.getTransaction(inn.id))?.transferId).toBeNull();
	});

	it('rejects pairing legs with unequal amounts or the same account', async () => {
		const { engine } = await makeBook();
		const a = await account(engine);
		const b = await account(engine, { name: 'B' });
		const t1 = await engine.addTransaction({
			accountId: a.id,
			date: '2026-10-05',
			payee: 'X',
			amountMinor: -5_000,
		});
		const t2 = await engine.addTransaction({
			accountId: b.id,
			date: '2026-10-05',
			payee: 'Y',
			amountMinor: 4_000,
		});
		await expect(engine.pairAsTransfer(t1.id, t2.id)).rejects.toThrow(/equal, opposite/);
	});
});

describe('splits', () => {
	it('splits a transaction, validates the sum, and collapses on recategorize', async () => {
		const { engine, cats } = await makeBook();
		const acc = await account(engine);
		const tx = await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-10',
			payee: 'Keells',
			amountMinor: -30_000,
		});

		await expect(
			engine.splitTransaction(tx.id, [
				{ categoryId: cats.groceries.id, amountMinor: -20_000 },
				{ categoryId: cats.eating.id, amountMinor: -5_000 },
			]),
		).rejects.toThrow(/sum/);

		await engine.splitTransaction(tx.id, [
			{ categoryId: cats.groceries.id, amountMinor: -20_000 },
			{ categoryId: cats.eating.id, amountMinor: -10_000 },
		]);
		const splits = await engine.listSplitsForTransaction(tx.id);
		expect(splits.map((s) => s.amountMinor).sort((x, y) => x - y)).toEqual([-20_000, -10_000]);
		expect((await engine.getTransaction(tx.id))?.categoryId).toBeNull();

		// Assigning one category replaces the split.
		await engine.updateTransaction(tx.id, { categoryId: cats.groceries.id });
		expect(await engine.listSplitsForTransaction(tx.id)).toHaveLength(0);
		expect((await engine.getTransaction(tx.id))?.categoryId).toBe(cats.groceries.id);
	});
});

describe('rules & payee memory', () => {
	it('applies the first matching rule and explains suggestions', async () => {
		const { engine, cats } = await makeBook();
		await engine.createRule({ payeeContains: 'keells' }, { categoryId: cats.groceries.id });

		const suggestion = await engine.suggestCategory('KEELLS SUPER, COLOMBO', 'a1');
		expect(suggestion.source).toBe('rule');
		expect(suggestion.categoryId).toBe(cats.groceries.id);
		expect(suggestion.reason).toContain('keells');

		const acc = await account(engine);
		const tx = await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-10',
			payee: 'KEELLS SUPER, COLOMBO',
			amountMinor: -8_000,
		});
		const applied = await engine.applyRulesToTransaction(tx);
		expect(applied.categoryId).toBe(cats.groceries.id);
	});

	it('respects rule priority, amount bounds and disabled rules', async () => {
		const { engine, cats } = await makeBook();
		await engine.createRule(
			{ payeeContains: 'dialog', amountMaxMinor: 5_000 },
			{ categoryId: cats.eating.id },
			0,
		);
		await engine.createRule({ payeeContains: 'dialog' }, { categoryId: cats.groceries.id }, 1);

		const acc = await account(engine);
		const small = await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-10',
			payee: 'Dialog',
			amountMinor: -3_000,
		});
		const large = await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-10',
			payee: 'Dialog',
			amountMinor: -9_000,
		});
		expect((await engine.applyRulesToTransaction(small)).categoryId).toBe(cats.eating.id);
		expect((await engine.applyRulesToTransaction(large)).categoryId).toBe(cats.groceries.id);

		// Advisory suggestions cannot evaluate amount constraints.
		expect((await engine.suggestCategory('Dialog', acc.id)).categoryId).toBe(cats.groceries.id);
	});

	it('previews rules without writing', async () => {
		const { engine, cats } = await makeBook();
		await engine.createRule({ payeeContains: 'uber' }, { categoryId: cats.eating.id });
		const acc = await account(engine);
		const tx = await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-10',
			payee: 'Uber trip',
			amountMinor: -2_500,
		});

		const preview = await engine.previewRules(90);
		expect(preview.find((row) => row.tx.id === tx.id)?.matchedRule).not.toBeNull();
		expect((await engine.getTransaction(tx.id))?.categoryId).toBeNull();
	});

	it('learns payee choices with a human-readable reason', async () => {
		const { engine, cats } = await makeBook();
		await engine.rememberPayeeChoice('Blue Bottle', 'a1', cats.eating.id);
		await engine.rememberPayeeChoice('Blue Bottle', 'a1', cats.eating.id);

		const suggestion = await engine.suggestCategory('BLUE BOTTLE #412', 'a1');
		expect(suggestion.source).toBe('payee-memory');
		expect(suggestion.categoryId).toBe(cats.eating.id);
		expect(suggestion.reason).toContain('Eating out');

		expect((await engine.suggestCategory('Unknown shop', 'a1')).source).toBe('none');
	});
});

describe('budgets', () => {
	it('computes spent/remaining and a projected-over pace', async () => {
		const { engine, cats } = await makeBook();
		const acc = await account(engine);
		await engine.setBudget('2026-10', cats.groceries.id, 50_000);

		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-03',
			payee: 'Keells',
			amountMinor: -20_000,
			categoryId: cats.groceries.id,
		});
		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-12',
			payee: 'Cargills',
			amountMinor: -15_000,
			categoryId: cats.groceries.id,
		});

		const status = await engine.budgetStatus('2026-10', FX);
		const row = status.byCategory.find((b) => b.categoryId === cats.groceries.id)!;
		expect(row.spentInBaseMinor).toBe(35_000);
		expect(row.remainingMinor).toBe(15_000);
		// Day 19 of 31 → projection ≈ 57,105 > 50,000.
		expect(row.pace).toBe('projected-over');
	});

	it('marks overspend and converts foreign-currency spending with explicit rates', async () => {
		const { engine, cats } = await makeBook();
		const lkr = await account(engine);
		const usd = await account(engine, {
			name: 'USD card',
			type: 'credit_card',
			currency: 'USD',
			openingBalanceMinor: 0,
		});
		await engine.setBudget('2026-10', cats.groceries.id, 10_000);

		await engine.addTransaction({
			accountId: usd.id,
			date: '2026-10-04',
			payee: 'Amazon',
			amountMinor: -100_00, // $100 → 30,000 LKR at 300
			categoryId: cats.groceries.id,
		});
		const status = await engine.budgetStatus('2026-10', FX);
		const row = status.byCategory.find((b) => b.categoryId === cats.groceries.id)!;
		expect(row.spentInBaseMinor).toBe(3_000_000);

		const noRates = await engine.budgetStatus('2026-10', { ...FX, rates: {} });
		expect(noRates.missingRates).toContain('USD');
		expect(
			noRates.byCategory.find((b) => b.categoryId === cats.groceries.id)!.spentInBaseMinor,
		).toBe(0);
		expect(lkr.id).toBeTruthy();
	});
});

describe('bills', () => {
	it('computes upcoming due dates across month boundaries', async () => {
		const { engine } = await makeBook();
		await engine.createBill({ name: 'Rent', amountMinor: 80_000, dueDay: 25, accountId: null });
		await engine.createBill({ name: 'Internet', amountMinor: 6_000, dueDay: 5, accountId: null });

		const soon = await engine.upcomingBills(14); // Oct 19 → Oct 25 + Nov 5 (17 days)
		expect(soon.map((b) => b.bill.name)).toEqual(['Rent']);

		const wider = await engine.upcomingBills(20);
		expect(wider.map((b) => `${b.bill.name}@${b.dueDate}`)).toEqual([
			'Rent@2026-10-25',
			'Internet@2026-11-05',
		]);
	});

	it('marks a bill paid and records the transaction', async () => {
		const { engine, cats } = await makeBook();
		const acc = await account(engine);
		const bill = await engine.createBill({
			name: 'Internet',
			amountMinor: 6_000,
			dueDay: 5,
			accountId: acc.id,
		});

		const tx = await engine.markBillPaid(bill.id, {
			accountId: acc.id,
			date: '2026-10-05',
			payee: 'Dialog',
			amountMinor: -6_000,
			categoryId: cats.eating.id,
		});
		expect(tx.amountMinor).toBe(-6_000);
		expect((await engine.listBills())[0].lastPaidAt).toBe('2026-10-05');
	});
});

describe('reports', () => {
	it('reports net worth per currency and converts only with explicit rates', async () => {
		const { engine } = await makeBook();
		await account(engine, { name: 'LKR account', openingBalanceMinor: 100_000 });
		await account(engine, {
			name: 'USD account',
			currency: 'USD',
			openingBalanceMinor: 10_000, // $100 → 3,000,000 LKR minor
		});

		const report = await engine.netWorth('2026-10-19', 'LKR', FX);
		expect(report.perCurrency).toEqual(
			expect.arrayContaining([
				{ currency: 'LKR', totalMinor: 100_000 },
				{ currency: 'USD', totalMinor: 10_000 },
			]),
		);
		expect(report.totalInBaseMinor).toBe(3_100_000);

		const missing = await engine.netWorth('2026-10-19', 'LKR', { ...FX, rates: {} });
		expect(missing.missingRates).toEqual(['USD']);
		expect(missing.totalInBaseMinor).toBe(100_000);
	});

	it('summarises income/expenses, excludes transfer legs, and honours splits', async () => {
		const { engine, cats } = await makeBook();
		const a = await account(engine);
		const b = await account(engine, { name: 'Savings', type: 'savings', openingBalanceMinor: 0 });

		await engine.addTransaction({
			accountId: a.id,
			date: '2026-10-01',
			payee: 'Employer',
			amountMinor: 500_000,
			categoryId: cats.salary.id,
		});
		const groceries = await engine.addTransaction({
			accountId: a.id,
			date: '2026-10-03',
			payee: 'Keells',
			amountMinor: -30_000,
			categoryId: cats.groceries.id,
		});
		await engine.addTransaction({
			accountId: a.id,
			date: '2026-10-04',
			payee: 'Transfer out',
			amountMinor: -20_000,
			transferToAccountId: b.id,
		});
		await engine.addTransaction({
			accountId: a.id,
			date: '2026-10-05',
			payee: 'Split purchase',
			amountMinor: -10_000,
		});
		await engine.splitTransaction(
			(await engine.listTransactions({ payeeContains: 'Split' }))[0].id,
			[
				{ categoryId: cats.groceries.id, amountMinor: -6_000 },
				{ categoryId: cats.eating.id, amountMinor: -4_000 },
			],
		);

		const summary = await engine.monthSummary('2026-10', 'LKR', FX);
		expect(summary.incomeInBaseMinor).toBe(500_000);
		expect(summary.expenseInBaseMinor).toBe(40_000);
		expect(summary.netInBaseMinor).toBe(460_000);
		expect(summary.missingRates).toEqual([]);

		const groceriesRow = summary.byCategory.find((c) => c.categoryId === cats.groceries.id)!;
		expect(groceriesRow.totalInBaseMinor).toBe(-36_000);
		expect(groceries.id).toBeTruthy();
	});
});

describe('import batches', () => {
	it('records batches upserted and undoes their transactions', async () => {
		const { engine, cats } = await makeBook();
		const acc = await account(engine);

		const batchId = 'batch-1';
		const batch = await engine.recordImportBatch({
			id: batchId,
			source: 'csv',
			label: 'October statement',
			accountId: acc.id,
			rowsTotal: 2,
			rowsImported: 0,
			rowsSkipped: 0,
		});
		expect(batch.createdAt).toBeTruthy();

		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-08',
			payee: 'Imported 1',
			amountMinor: -1_000,
			categoryId: cats.groceries.id,
			source: 'import',
			importBatchId: batchId,
		});
		await engine.addTransaction({
			accountId: acc.id,
			date: '2026-10-09',
			payee: 'Imported 2',
			amountMinor: -2_000,
			source: 'import',
			importBatchId: batchId,
		});

		await engine.recordImportBatch({
			id: batchId,
			source: 'csv',
			label: 'October statement',
			accountId: acc.id,
			rowsTotal: 3,
			rowsImported: 2,
			rowsSkipped: 1,
		});
		const after = (await engine.listImportBatches())[0];
		expect(after.rowsImported).toBe(2);
		expect(after.rowsSkipped).toBe(1);
		expect(after.createdAt).toBe(batch.createdAt);

		expect(await engine.undoImportBatch(batchId)).toBe(2);
		expect(await engine.listTransactions()).toHaveLength(0);
		expect(await engine.listImportBatches()).toHaveLength(0);
	});
});

describe('default categories', () => {
	it('seeds a two-level tree once', async () => {
		const { engine } = await makeBook();
		// makeBook already created four categories → seeding is a no-op.
		await seedDefaultCategories(engine);
		expect((await engine.listCategories({ includeArchived: true })).length).toBe(4);

		const freshRepo = new MemoryRepository();
		const fresh = createEngine(freshRepo, CLOCK);
		await seedDefaultCategories(fresh);
		const categories = await fresh.listCategories({ includeArchived: true });
		expect(categories.length).toBeGreaterThan(20);
		expect(categories.some((c) => c.name === 'Groceries' && c.parentId !== null)).toBe(true);
		expect(categories.some((c) => c.name === 'Salary' && c.kind === 'income')).toBe(true);
	});
});

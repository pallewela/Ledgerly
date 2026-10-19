import { describe, expect, it } from 'vitest';
import type { EngineApi } from '../../engine/api';
import { createEngine } from '../../engine/engine';
import { MemoryRepository } from '../../engine/memory-repository';
import { commitImport } from '../commit';
import { detectDateFormat, normalizeDate, parseAmountToMinor, parseCsv } from '../csv';
import { buildImportPlan } from '../plan';
import type { CsvColumnMapping } from '../types';

const FIXED_NOW = new Date('2026-10-19T09:30:00Z');
const clock = () => FIXED_NOW;

async function makeLkrAccount(engine: EngineApi) {
	return engine.createAccount({
		name: 'Day-to-day',
		type: 'checking',
		currency: 'LKR',
		openingBalanceMinor: 0,
	});
}

const LKR_CSV = `Date,Description,Amount,Balance
19/10/2026,Keells Super,"Rs -1,234.56","Rs 125,000.00"
20/10/2026,Cargills Food City,"Rs -2,500.00","Rs 122,500.00"
21/10/2026,Salary,"Rs 250,000.00","Rs 372,500.00"
`;

const LKR_MAPPING: CsvColumnMapping = {
	date: 'Date',
	payee: 'Description',
	amount: 'Amount',
	balance: 'Balance',
};

describe('parseCsv', () => {
	it('trims headers and values while keeping empty cells', () => {
		const parsed = parseCsv(
			'\uFEFF Date , Description ,Amount,Note\n 19/10/2026 , Keells ," 1,234.56 ", \n\n',
		);
		expect(parsed.headers).toEqual(['Date', 'Description', 'Amount', 'Note']);
		expect(parsed.rows).toHaveLength(1);
		expect(parsed.rows[0].Date).toBe('19/10/2026');
		expect(parsed.rows[0].Description).toBe('Keells');
		expect(parsed.rows[0].Amount).toBe('1,234.56');
		expect(parsed.rows[0].Note).toBe('');
	});
});

describe('amount parsing', () => {
	it('reads LKR amounts with an Rs prefix, thousands and dot decimals', () => {
		expect(parseAmountToMinor('Rs 1,234.56', 'LKR')).toBe(123_456);
		expect(parseAmountToMinor('Rs. 1,234.56', 'LKR')).toBe(123_456);
		expect(parseAmountToMinor('  Rs 250,000.00  ', 'LKR')).toBe(25_000_000);
		expect(parseAmountToMinor('$1,234.56', 'USD')).toBe(123_456);
	});

	it('auto-detects decimal comma and dot styles', () => {
		expect(parseAmountToMinor('1.234,56', 'EUR')).toBe(123_456);
		expect(parseAmountToMinor('1 234,56', 'EUR')).toBe(123_456);
		expect(parseAmountToMinor('1\u00a0234,56', 'EUR')).toBe(123_456);
		expect(parseAmountToMinor('1,234.56', 'USD')).toBe(123_456);
		expect(parseAmountToMinor('1,234', 'USD')).toBe(123_400);
		expect(parseAmountToMinor('12,34', 'EUR')).toBe(1_234);
		expect(parseAmountToMinor('1.234,56', 'EUR', 'comma')).toBe(123_456);
		expect(parseAmountToMinor('1,234.56', 'USD', 'dot')).toBe(123_456);
		expect(parseAmountToMinor('1,234', 'JPY')).toBe(1_234);
	});

	it('treats parentheses, unicode minus and trailing signs as negative', () => {
		expect(parseAmountToMinor('(123.45)', 'USD')).toBe(-12_345);
		expect(parseAmountToMinor('(1.234,56)', 'EUR')).toBe(-123_456);
		expect(parseAmountToMinor('\u221245.10', 'USD')).toBe(-4_510);
		expect(parseAmountToMinor('-45.10', 'USD')).toBe(-4_510);
		expect(parseAmountToMinor('45.10-', 'USD')).toBe(-4_510);
		expect(parseAmountToMinor('+45.10', 'USD')).toBe(4_510);
	});

	it('returns null instead of NaN for unparseable cells', () => {
		expect(parseAmountToMinor('', 'USD')).toBeNull();
		expect(parseAmountToMinor('   ', 'USD')).toBeNull();
		expect(parseAmountToMinor('n/a', 'USD')).toBeNull();
		expect(parseAmountToMinor('1.2.3', 'USD')).toBeNull();
		expect(parseAmountToMinor('12,34,56', 'EUR')).toBeNull();
	});
});

describe('date parsing', () => {
	it('detects day-first, month-first and ISO samples', () => {
		expect(detectDateFormat(['19/10/2026', '20/10/2026'])).toBe('DD/MM/YYYY');
		expect(detectDateFormat(['10/19/2026'])).toBe('MM/DD/YYYY');
		expect(detectDateFormat(['2026-10-19'])).toBe('YYYY-MM-DD');
		expect(detectDateFormat(['01/02/2026'])).toBe('unknown');
		expect(detectDateFormat([])).toBe('unknown');
	});

	it('rejects impossible dates and normalizes single-digit components', () => {
		expect(normalizeDate('2026-02-30', 'YYYY-MM-DD')).toBeNull();
		expect(normalizeDate('29/02/2025', 'DD/MM/YYYY')).toBeNull();
		expect(normalizeDate('29/02/2024', 'DD/MM/YYYY')).toBe('2024-02-29');
		expect(normalizeDate('5/7/2026', 'DD/MM/YYYY')).toBe('2026-07-05');
		expect(normalizeDate('7/5/2026', 'MM/DD/YYYY')).toBe('2026-07-05');
		expect(normalizeDate('2026-2-3', 'YYYY-MM-DD')).toBe('2026-02-03');
	});
});

describe('buildImportPlan', () => {
	it('parses a realistic LKR CSV end to end', () => {
		const parsed = parseCsv(LKR_CSV);
		const plan = buildImportPlan({
			accountId: 'acct',
			currency: 'LKR',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: LKR_MAPPING,
			existingTransactions: [],
		});

		expect(plan.summary).toEqual({ total: 3, valid: 3, duplicates: 0, errors: 0 });
		expect(plan.rows[0]).toMatchObject({
			date: '2026-10-19',
			payee: 'Keells Super',
			amountMinor: -123_456,
			balanceMinor: 12_500_000,
			issues: [],
		});
		expect(plan.rows[1]).toMatchObject({
			date: '2026-10-20',
			amountMinor: -250_000,
			balanceMinor: 12_250_000,
		});
		expect(plan.rows[2]).toMatchObject({
			date: '2026-10-21',
			amountMinor: 25_000_000,
		});
	});

	it('builds amounts from debit and credit columns', () => {
		const parsed = parseCsv(`Date,Description,Debit,Credit
19/10/2026,ATM withdrawal,1000.00,
20/10/2026,Salary,,250000.00
21/10/2026,Bank fee,50.00,0.00
`);
		const plan = buildImportPlan({
			accountId: 'acct',
			currency: 'LKR',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: { date: 'Date', payee: 'Description', debit: 'Debit', credit: 'Credit' },
			existingTransactions: [],
		});

		expect(plan.rows[0].amountMinor).toBe(-100_000);
		expect(plan.rows[1].amountMinor).toBe(25_000_000);
		expect(plan.rows[2].amountMinor).toBe(-5_000);
		expect(plan.summary.errors).toBe(0);
	});

	it('flags parentheses amounts, blank amounts and zero amounts', () => {
		const parsed = parseCsv(`Date,Description,Amount
19/10/2026,Refund,"(123.45)"
20/10/2026,Mystery,
21/10/2026,Fee,"\u221245.10"
22/10/2026,Zero,"0.00"
`);
		const plan = buildImportPlan({
			accountId: 'acct',
			currency: 'USD',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: { date: 'Date', payee: 'Description', amount: 'Amount' },
			existingTransactions: [],
		});

		expect(plan.rows[0].amountMinor).toBe(-12_345);
		expect(plan.rows[0].issues).toEqual([]);
		expect(plan.rows[1].amountMinor).toBe(0);
		expect(plan.rows[1].issues).toContain('missing amount');
		expect(plan.rows[2].amountMinor).toBe(-4_510);
		expect(plan.rows[3].amountMinor).toBe(0);
		expect(plan.rows[3].issues).toContain('zero amount');
		expect(plan.summary).toEqual({ total: 4, valid: 2, duplicates: 0, errors: 2 });
	});

	it('flags every row when the date format cannot be resolved', () => {
		const parsed = parseCsv(`Date,Description,Amount
01/02/2026,Shop,10.00
02/03/2026,Shop,20.00
`);
		const plan = buildImportPlan({
			accountId: 'acct',
			currency: 'USD',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: { date: 'Date', payee: 'Description', amount: 'Amount' },
			existingTransactions: [],
		});

		expect(plan.summary).toEqual({ total: 2, valid: 0, duplicates: 0, errors: 2 });
		expect(plan.rows.every((row) => row.issues.includes('unknown date format'))).toBe(true);
	});

	it('dedupes against existing transactions and earlier plan rows', async () => {
		const engine = createEngine(new MemoryRepository(), clock);
		const account = await makeLkrAccount(engine);
		await engine.addTransaction({
			accountId: account.id,
			date: '2026-10-15',
			payee: 'Keells Super',
			amountMinor: -123_456,
		});
		const existing = await engine.listTransactions({ accountIds: [account.id] });

		const parsed = parseCsv(`Date,Description,Amount
18/10/2026,KEELLS SUPER MARKET,"Rs -1,234.56"
20/10/2026,Keells Super Market,"Rs -3,456.00"
16/10/2026,Cargills Food City,"Rs -1,234.56"
05/10/2026,Arpico Superstore,"Rs -5,000.00"
06/10/2026,Arpico Superstore,"Rs -5,000.00"
`);
		const plan = buildImportPlan({
			accountId: account.id,
			currency: 'LKR',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: { date: 'Date', payee: 'Description', amount: 'Amount' },
			existingTransactions: existing,
		});

		expect(plan.rows[0].duplicateOf).toBe(existing[0].id); // 3 days, same amount, contained payee
		expect(plan.rows[1].duplicateOf).toBeNull(); // 5 days away
		expect(plan.rows[2].duplicateOf).toBeNull(); // different payee
		expect(plan.rows[3].duplicateOf).toBeNull();
		expect(plan.rows[4].duplicateOf).toBe('plan:3'); // later duplicate within the plan
		expect(plan.summary).toEqual({ total: 5, valid: 5, duplicates: 2, errors: 0 });
	});

	it('commits through the engine and undoes the whole batch', async () => {
		const engine = createEngine(new MemoryRepository(), clock);
		const account = await makeLkrAccount(engine);
		const parsed = parseCsv(LKR_CSV);
		const plan = buildImportPlan({
			accountId: account.id,
			currency: 'LKR',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: LKR_MAPPING,
			existingTransactions: await engine.listTransactions(),
		});
		expect(plan.summary).toEqual({ total: 3, valid: 3, duplicates: 0, errors: 0 });

		const result = await commitImport({ engine, plan });
		expect(result.imported).toBe(3);
		expect(result.skipped).toBe(0);

		const txs = await engine.listTransactions({ accountIds: [account.id] });
		expect(txs).toHaveLength(3);
		expect(txs.every((tx) => tx.importBatchId === result.batchId)).toBe(true);
		expect(txs.every((tx) => tx.source === 'import')).toBe(true);
		expect(txs.map((tx) => tx.amountMinor).sort((a, b) => a - b)).toEqual([
			-250_000, -123_456, 25_000_000,
		]);

		const batches = await engine.listImportBatches();
		expect(batches).toHaveLength(1);
		expect(batches[0]).toMatchObject({
			id: result.batchId,
			source: 'csv',
			accountId: account.id,
			rowsTotal: 3,
			rowsImported: 3,
			rowsSkipped: 0,
		});

		expect(await engine.undoImportBatch(result.batchId)).toBe(3);
		expect(await engine.listTransactions({ accountIds: [account.id] })).toHaveLength(0);
		expect(await engine.listImportBatches()).toHaveLength(0);
	});
});

describe('commitImport', () => {
	it('skips duplicates when asked and records the skipped count', async () => {
		const engine = createEngine(new MemoryRepository(), clock);
		const account = await makeLkrAccount(engine);
		await engine.addTransaction({
			accountId: account.id,
			date: '2026-10-15',
			payee: 'Keells Super',
			amountMinor: -123_456,
		});
		const parsed = parseCsv(`Date,Description,Amount
18/10/2026,KEELLS SUPER MARKET,"Rs -1,234.56"
`);
		const plan = buildImportPlan({
			accountId: account.id,
			currency: 'LKR',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: { date: 'Date', payee: 'Description', amount: 'Amount' },
			existingTransactions: await engine.listTransactions({ accountIds: [account.id] }),
		});
		expect(plan.rows[0].duplicateOf).not.toBeNull();

		const result = await commitImport({ engine, plan, skipDuplicates: true });
		expect(result.imported).toBe(0);
		expect(result.skipped).toBe(1);
		expect(await engine.listTransactions({ accountIds: [account.id] })).toHaveLength(1);

		const batches = await engine.listImportBatches();
		expect(batches).toHaveLength(1);
		expect(batches[0]).toMatchObject({ rowsTotal: 1, rowsImported: 0, rowsSkipped: 1 });
	});

	it('undoes the batch when an insert throws', async () => {
		const engine = createEngine(new MemoryRepository(), clock);
		const account = await makeLkrAccount(engine);
		const parsed = parseCsv(LKR_CSV);
		const plan = buildImportPlan({
			accountId: account.id,
			currency: 'LKR',
			headers: parsed.headers,
			rows: parsed.rows,
			mapping: LKR_MAPPING,
			existingTransactions: [],
		});
		let inserts = 0;
		const failing: EngineApi = {
			...engine,
			async addTransaction(input) {
				inserts += 1;
				if (inserts === 2) throw new Error('insert failed');
				return engine.addTransaction(input);
			},
		};

		await expect(commitImport({ engine: failing, plan })).rejects.toThrow('insert failed');
		expect(await engine.listTransactions({ accountIds: [account.id] })).toHaveLength(0);
		expect(await engine.listImportBatches()).toHaveLength(0);
	});
});

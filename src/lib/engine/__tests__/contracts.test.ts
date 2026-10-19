import { describe, expect, it } from 'vitest';
import { CURRENCIES, convertMoney, formatMoney, minorUnitExponent, money } from '../currency';
import { MemoryRepository } from '../memory-repository';
import { newId, normalizePayeeKey } from '../util';
import type { Transaction } from '../types';

describe('currency contracts (Gate G1)', () => {
	it('exposes the day-one currencies LKR, USD, AUD with 2-decimal exponents', () => {
		for (const code of ['LKR', 'USD', 'AUD']) {
			expect(CURRENCIES[code]).toBeDefined();
			expect(minorUnitExponent(code)).toBe(2);
		}
		expect(minorUnitExponent('JPY')).toBe(0);
	});

	it('formats money without throwing and keeps the amount visible', () => {
		expect(formatMoney(money(150_000, 'LKR'))).toContain('1,500');
		expect(formatMoney(money(-2_450, 'USD'))).toContain('24.50');
	});

	it('converts only with an explicit, dated rate table and reports gaps', () => {
		const table = { base: 'LKR', asOf: '2026-10-19', rates: { USD: 300 } };
		expect(convertMoney(money(10_00, 'USD'), table)).toEqual({
			minorUnits: 300_000,
			currency: 'LKR',
		});
		expect(convertMoney(money(10_00, 'USD'), { ...table, rates: {} })).toBeUndefined();
	});
});

describe('memory repository (reference semantics)', () => {
	it('round-trips accounts and transactions', async () => {
		const repo = new MemoryRepository();
		await repo.putAccount({
			id: 'a1',
			name: 'Day-to-day',
			institution: null,
			type: 'checking',
			currency: 'LKR',
			openingBalanceMinor: 250_000,
			includeInNetWorth: true,
			archivedAt: null,
			createdAt: '2026-10-19T00:00:00Z',
			updatedAt: '2026-10-19T00:00:00Z',
		});
		const tx: Transaction = {
			id: newId(),
			accountId: 'a1',
			date: '2026-10-18',
			payee: 'Keells',
			amountMinor: -4_350,
			categoryId: null,
			note: null,
			tags: [],
			transferId: null,
			importBatchId: null,
			source: 'manual',
			createdAt: '2026-10-19T00:00:00Z',
			updatedAt: '2026-10-19T00:00:00Z',
		};
		await repo.putTransaction(tx);
		expect((await repo.listAccounts()).length).toBe(1);
		expect(await repo.getTransaction(tx.id)).toEqual(tx);
	});

	it('filters transactions by date, account, payee and transfer flag', async () => {
		const repo = new MemoryRepository();
		const base: Transaction = {
			id: 't1',
			accountId: 'a1',
			date: '2026-10-18',
			payee: 'Keells Super',
			amountMinor: -4_350,
			categoryId: null,
			note: null,
			tags: [],
			transferId: null,
			importBatchId: null,
			source: 'manual',
			createdAt: '2026-10-19T00:00:00Z',
			updatedAt: '2026-10-19T00:00:00Z',
		};
		await repo.putTransaction(base);
		await repo.putTransaction({
			...base,
			id: 't2',
			date: '2026-10-02',
			payee: 'Dialog Bill',
			transferId: 'tr1',
		});
		await repo.putTransaction({ ...base, id: 't3', accountId: 'a2' });

		expect((await repo.listTransactions({ from: '2026-10-10' })).map((t) => t.id)).toEqual([
			't1',
			't3',
		]);
		expect((await repo.listTransactions({ accountIds: ['a1'] })).length).toBe(2);
		expect((await repo.listTransactions({ payeeContains: 'keells' })).length).toBe(2);
		expect((await repo.listTransactions({ hasTransfer: true })).map((t) => t.id)).toEqual(['t2']);
		expect((await repo.listTransactions({ limit: 2 })).length).toBe(2);
	});

	it('clears everything', async () => {
		const repo = new MemoryRepository();
		await repo.putSetting('baseCurrency', 'LKR');
		await repo.clear();
		expect(await repo.getSetting('baseCurrency')).toBeUndefined();
	});
});

describe('payee normalization (shared matching key)', () => {
	it('collapses noise characters so memory, rules and dedupe agree', () => {
		expect(normalizePayeeKey('SQ *BLUE BOTTLE #412')).toBe('SQBLUEBOTTLE412');
		expect(normalizePayeeKey('keells super')).toBe('KEELLSSUPER');
	});
});

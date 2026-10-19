import type { Transaction } from '../engine/types';
import { normalizePayeeKey } from '../engine/util';
import { detectDateFormat, normalizeDate, parseAmountToMinor } from './csv';
import type { CsvColumnMapping, DateFormat, ImportPlan, ImportRow } from './types';

/** A row may sit this many calendar days from an existing transaction and still match. */
const DUPLICATE_WINDOW_DAYS = 3;
const DAY_MS = 86_400_000;

export interface BuildImportPlanArgs {
	accountId: string;
	currency: string;
	/** Headers from parseCsv; kept for callers that validate mappings up front. */
	headers: string[];
	rows: Array<Record<string, string>>;
	mapping: CsvColumnMapping;
	existingTransactions: Transaction[];
	/** Overrides mapping.dateFormat when both are present. */
	dateFormat?: CsvColumnMapping['dateFormat'];
}

function cell(row: Record<string, string>, column: string): string {
	const value = row[column];
	return typeof value === 'string' ? value.trim() : '';
}

function utcDay(isoDate: string): number {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
	if (!match) return Number.NaN;
	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
}

/** Same payee when keys are equal, or one contains the other and is not tiny. */
function samePayee(a: string, b: string): boolean {
	if (a === '' || b === '') return false;
	if (a === b) return true;
	const shorter = a.length <= b.length ? a : b;
	const longer = a.length <= b.length ? b : a;
	return shorter.length >= 3 && longer.includes(shorter);
}

function resolveDateFormat(
	mapping: CsvColumnMapping,
	rows: Array<Record<string, string>>,
	override: CsvColumnMapping['dateFormat'],
): DateFormat | null {
	const fromOverride = override && override !== 'auto' ? override : null;
	const fromMapping =
		mapping.dateFormat && mapping.dateFormat !== 'auto' ? mapping.dateFormat : null;
	const explicit = fromOverride ?? fromMapping;
	if (explicit) return explicit;
	const samples = rows.map((row) => cell(row, mapping.date)).filter((sample) => sample !== '');
	const detected = detectDateFormat(samples);
	return detected === 'unknown' ? null : detected;
}

/**
 * Build a preview plan: normalize every row, collect issues, and flag likely
 * duplicates against existing transactions on the same account (same amount,
 * within ±3 days, matching payee key) and against earlier rows in the plan.
 */
export function buildImportPlan(args: BuildImportPlanArgs): ImportPlan {
	const { accountId, currency, rows, mapping } = args;
	const decimal = mapping.decimal ?? 'auto';
	const format = resolveDateFormat(mapping, rows, args.dateFormat);

	if (!format) {
		const errorRows: ImportRow[] = rows.map((row, index) => ({
			index,
			date: '',
			payee: cell(row, mapping.payee),
			amountMinor: 0,
			balanceMinor: null,
			issues: [cell(row, mapping.date) === '' ? 'missing date' : 'unknown date format'],
			duplicateOf: null,
		}));
		return {
			accountId,
			currency,
			rows: errorRows,
			summary: {
				total: errorRows.length,
				valid: 0,
				duplicates: 0,
				errors: errorRows.length,
			},
		};
	}

	const existing = args.existingTransactions
		.filter((tx) => tx.accountId === accountId)
		.map((tx) => ({
			id: tx.id,
			amountMinor: tx.amountMinor,
			day: utcDay(tx.date),
			key: normalizePayeeKey(tx.payee),
		}))
		.filter((candidate) => Number.isFinite(candidate.day));

	const planned: ImportRow[] = [];
	const seen: Array<{ index: number; amountMinor: number; day: number; key: string }> = [];

	for (const [index, source] of rows.entries()) {
		const issues: string[] = [];

		const dateCell = cell(source, mapping.date);
		let date = '';
		if (dateCell === '') issues.push('missing date');
		else {
			const normalized = normalizeDate(dateCell, format);
			if (normalized === null) issues.push('invalid date');
			else date = normalized;
		}

		const payee = cell(source, mapping.payee);
		if (payee === '') issues.push('missing payee');

		let amountMinor = 0;
		if (mapping.amount) {
			const amountCell = cell(source, mapping.amount);
			if (amountCell === '') issues.push('missing amount');
			else {
				const parsed = parseAmountToMinor(amountCell, currency, decimal);
				if (parsed === null) issues.push('invalid amount');
				else amountMinor = parsed;
			}
		} else if (mapping.debit || mapping.credit) {
			const debitCell = mapping.debit ? cell(source, mapping.debit) : '';
			const creditCell = mapping.credit ? cell(source, mapping.credit) : '';
			if (debitCell === '' && creditCell === '') {
				issues.push('missing amount');
			} else {
				const debit = debitCell === '' ? 0 : parseAmountToMinor(debitCell, currency, decimal);
				const credit = creditCell === '' ? 0 : parseAmountToMinor(creditCell, currency, decimal);
				if (debit === null || credit === null) issues.push('invalid amount');
				else amountMinor = Math.abs(credit) - Math.abs(debit);
			}
		} else {
			issues.push('missing amount');
		}
		// The engine rejects zero transactions; surface it during preview instead.
		if (
			amountMinor === 0 &&
			!issues.includes('invalid amount') &&
			!issues.includes('missing amount')
		) {
			issues.push('zero amount');
		}

		let balanceMinor: number | null = null;
		if (mapping.balance) {
			const balanceCell = cell(source, mapping.balance);
			if (balanceCell !== '') {
				const parsed = parseAmountToMinor(balanceCell, currency, decimal);
				if (parsed === null) issues.push('invalid balance');
				else balanceMinor = parsed;
			}
		}

		let duplicateOf: string | null = null;
		if (issues.length === 0) {
			const key = normalizePayeeKey(payee);
			const day = utcDay(date);

			let bestId: string | null = null;
			let bestDiff = Number.POSITIVE_INFINITY;
			for (const candidate of existing) {
				if (candidate.amountMinor !== amountMinor) continue;
				const diff = Math.abs(candidate.day - day);
				if (diff > DUPLICATE_WINDOW_DAYS) continue;
				if (!samePayee(key, candidate.key)) continue;
				if (diff < bestDiff) {
					bestDiff = diff;
					bestId = candidate.id;
				}
			}
			if (bestId === null) {
				for (const prior of seen) {
					if (prior.amountMinor !== amountMinor) continue;
					const diff = Math.abs(prior.day - day);
					if (diff > DUPLICATE_WINDOW_DAYS) continue;
					if (!samePayee(key, prior.key)) continue;
					if (diff < bestDiff) {
						bestDiff = diff;
						bestId = `plan:${prior.index}`;
					}
				}
			}
			duplicateOf = bestId;
			seen.push({ index, amountMinor, day, key });
		}

		planned.push({
			index,
			date,
			payee,
			amountMinor: issues.length === 0 ? amountMinor : 0,
			balanceMinor,
			issues,
			duplicateOf,
		});
	}

	const errors = planned.filter((row) => row.issues.length > 0).length;
	const duplicates = planned.filter(
		(row) => row.issues.length === 0 && row.duplicateOf !== null,
	).length;
	return {
		accountId,
		currency,
		rows: planned,
		summary: {
			total: planned.length,
			valid: planned.length - errors,
			duplicates,
			errors,
		},
	};
}

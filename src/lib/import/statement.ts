/**
 * Statement table extraction — the shared core behind PDF and screenshot
 * imports. Takes positioned text (from PDF.js text items or OCR word boxes),
 * reconstructs lines, and pulls out transaction rows using layout heuristics:
 *
 *   [date]  [description]  [amount]  [balance]
 *
 * Everything here is pure TypeScript and unit-tested with synthetic layouts.
 * The PDF/OCR adapters only convert their engine output into PositionedText.
 */

import { minorUnitExponent } from '../engine/currency';
import { parseAmountToMinor } from './csv';

export interface PositionedText {
	text: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
	page?: number;
}

export interface ExtractedTable {
	headers: ['Date', 'Description', 'Amount', 'Balance'];
	rows: Array<Record<string, string>>;
	meta: {
		pages: number;
		/** Lines that looked like a transaction row. */
		candidates: number;
		/** Lines rejected (headers, notes, unparseable rows). */
		skipped: number;
	};
}

export interface ExtractOptions {
	/** Account currency — drives amount parsing and the default date order. */
	currency: string;
	/** Year for dates that omit one ("18 Oct"). Defaults to the current year. */
	defaultYear?: number;
	/** Force a numeric date order; otherwise inferred from the rows. */
	dateOrder?: 'DMY' | 'MDY';
}

interface Line {
	page: number;
	y: number;
	items: PositionedText[];
	text: string;
}

interface RawRow {
	isoDate: string;
	payee: string;
	amountMinor: number;
	balanceMinor: number | null;
}

const MONTHS: Record<string, number> = {
	jan: 1,
	january: 1,
	feb: 2,
	february: 2,
	mar: 3,
	march: 3,
	apr: 4,
	april: 4,
	may: 5,
	jun: 6,
	june: 6,
	jul: 7,
	july: 7,
	aug: 8,
	august: 8,
	sep: 9,
	sept: 9,
	september: 9,
	oct: 10,
	october: 10,
	nov: 11,
	november: 11,
	dec: 12,
	december: 12,
};

const CURRENCY_MARKERS =
	/^(rs\.?|lkr|usd|aud|eur|gbp|inr|jpy|cad|sgd|myr|aed|thb|\$|a\$|s\$|ca\$|nz\$|₹|€|£|¥)$/i;

/** Words that suggest an unsigned amount is income rather than spending. */
const INCOME_HINTS =
	/salary|payroll|interest|dividend|deposit|refund|reversal|reimburs|incoming|credited|credit received/i;

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

function validIso(year: number, month: number, day: number): string | null {
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}
	return `${year}-${pad2(month)}-${pad2(day)}`;
}

function expandYear(raw: string): number {
	const year = Number(raw);
	return year < 100 ? 2000 + year : year;
}

function monthFromName(name: string): number | null {
	return MONTHS[name.toLowerCase()] ?? null;
}

interface DateMatch {
	iso: string;
	rest: string;
}

function parseLeadingDate(
	text: string,
	dateOrder: 'DMY' | 'MDY',
	defaultYear: number,
): DateMatch | null {
	// ISO first.
	let match = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(text);
	if (match) {
		const iso = validIso(Number(match[1]), Number(match[2]), Number(match[3]));
		if (iso) return { iso, rest: text.slice(match[0].length).trim() };
	}

	// Numeric d/m/y or m/d/y.
	match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?!\d)/.exec(text);
	if (match) {
		const a = Number(match[1]);
		const b = Number(match[2]);
		const year = expandYear(match[3]);
		const iso = dateOrder === 'DMY' ? validIso(year, b, a) : validIso(year, a, b);
		if (iso) return { iso, rest: text.slice(match[0].length).trim() };
	}

	// 18 Oct 2026 / 18-Oct-26
	match = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})(?!\d)/.exec(text);
	if (match) {
		const month = monthFromName(match[2]);
		const iso = month ? validIso(expandYear(match[3]), month, Number(match[1])) : null;
		if (iso) return { iso, rest: text.slice(match[0].length).trim() };
	}

	// Oct 18, 2026 / Oct-18-26
	match = /^([A-Za-z]{3,9})[-\s](\d{1,2}),?[-\s](\d{2,4})(?!\d)/.exec(text);
	if (match) {
		const month = monthFromName(match[1]);
		const iso = month ? validIso(expandYear(match[3]), month, Number(match[2])) : null;
		if (iso) return { iso, rest: text.slice(match[0].length).trim() };
	}

	// 18 Oct — year omitted, common in banking-app screenshots.
	match = /^(\d{1,2})[-\s]([A-Za-z]{3,9})(?!\d)/.exec(text);
	if (match) {
		const month = monthFromName(match[2]);
		const iso = month ? validIso(defaultYear, month, Number(match[1])) : null;
		if (iso) return { iso, rest: text.slice(match[0].length).trim() };
	}

	// Oct 18 — year omitted.
	match = /^([A-Za-z]{3,9})[-\s](\d{1,2})(?!\d)/.exec(text);
	if (match) {
		const month = monthFromName(match[1]);
		const iso = month ? validIso(defaultYear, month, Number(match[2])) : null;
		if (iso) return { iso, rest: text.slice(match[0].length).trim() };
	}

	return null;
}

interface ParsedAmount {
	minor: number;
	/** True when the text carried an explicit '+', CR or credit marker. */
	explicitPositive: boolean;
}

function parseAmountToken(raw: string, currency: string): ParsedAmount | null {
	let text = raw.replace(/\u2212/g, '-').trim();
	let creditDebit: 'cr' | 'dr' | null = null;

	const marker = /\s(CR|DR)\.?$/i.exec(text);
	if (marker) {
		creditDebit = marker[1].toLowerCase() as 'cr' | 'dr';
		text = text.slice(0, marker.index).trim();
	}

	const hasParens = /^\(.*\)$/.test(text);
	// OCR sometimes drops the decimal point in grouped amounts:
	// "1,634,24317" → "1,634,243.17".
	if (!/[.,]\d{2}$/.test(text)) {
		const repaired = text.replace(/^(\d{1,3}(?:[ ,]\d{3})+)(\d{2})$/, '$1.$2');
		if (repaired !== text) text = repaired;
	}
	const hasCurrency =
		/(rs\.?|lkr|usd|aud|eur|gbp|inr|jpy|cad|sgd|myr|aed|thb|\$|a\$|s\$|ca\$|₹|€|£|¥)/i.test(text);
	const hasDecimal = /[.,]\d{1,2}\)?$/.test(text);
	const hasSign = /^[+-]/.test(text);
	const explicit = hasParens || hasCurrency || hasSign || creditDebit !== null;

	// Bare integers are not amounts: avoids mistaking years, IDs and counts
	// inside descriptions for money.
	if (!hasDecimal && !explicit) return null;

	const minor = parseAmountToMinor(text, currency);
	if (minor === null) return null;

	let value = minor;
	let explicitPositive = /^\+/.test(text) || creditDebit === 'cr';
	if (creditDebit === 'dr') value = -Math.abs(value);
	if (creditDebit === 'cr') {
		value = Math.abs(value);
		explicitPositive = true;
	}
	if (hasParens) value = -Math.abs(value);
	return { minor: value, explicitPositive };
}

interface SplitAmounts {
	description: string;
	amount: ParsedAmount;
	balance: ParsedAmount | null;
}

function isCurrencyMarker(value: string): boolean {
	return CURRENCY_MARKERS.test(value.replace(/[.,]$/, ''));
}

function isCreditDebitMarker(value: string): boolean {
	return /^(cr|dr)\.?$/i.test(value);
}

/**
 * Strip leading OCR noise from banking-app icons (a lone letter, punctuation),
 * while leaving real payees such as "A&W" or "St. Mary" untouched.
 */
function cleanPayee(payee: string): string {
	const tokens = payee.split(/\s+/).filter(Boolean);
	while (tokens.length > 1) {
		const first = tokens[0];
		const singleLetter = /^[A-Za-z]$/.test(first);
		const noLettersOrDigits = !/[\p{L}\p{N}]/u.test(first);
		if (!singleLetter && !noLettersOrDigits) break;
		tokens.shift();
	}
	return tokens.join(' ');
}

function trimDescription(tokens: string[]): string {
	let end = tokens.length;
	while (end > 0 && isCurrencyMarker(tokens[end - 1])) end -= 1;
	return tokens.slice(0, end).join(' ');
}

function splitTrailingAmounts(text: string, currency: string): SplitAmounts | null {
	const tokens = text.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return null;

	const last = tokens[tokens.length - 1];
	const lastAmount = parseAmountToken(last, currency);

	if (lastAmount) {
		const previous = tokens[tokens.length - 2];
		const previousAmount = previous ? parseAmountToken(previous, currency) : null;

		// "1,234.56 45,678.90" — amount then running balance.
		if (previousAmount) {
			return {
				description: trimDescription(tokens.slice(0, -2)),
				amount: previousAmount,
				balance: lastAmount,
			};
		}

		// "1,000.00 CR 1,000.00" — marked amount then running balance.
		if (previous && isCreditDebitMarker(previous)) {
			const before = tokens[tokens.length - 3];
			const beforeAmount = before ? parseAmountToken(before, currency) : null;
			if (beforeAmount) {
				const marked = parseAmountToken(`${before} ${previous}`, currency);
				if (marked) {
					return {
						description: trimDescription(tokens.slice(0, -3)),
						amount: marked,
						balance: lastAmount,
					};
				}
			}
		}

		// "Rs 1,234.56" — currency marker glued to the amount.
		if (previous && isCurrencyMarker(previous)) {
			const combined = parseAmountToken(`${previous} ${last}`, currency);
			if (combined) {
				return {
					description: trimDescription(tokens.slice(0, -2)),
					amount: combined,
					balance: null,
				};
			}
		}

		return { description: trimDescription(tokens.slice(0, -1)), amount: lastAmount, balance: null };
	}

	// "1,234.56 CR" / "Rs 1,234.56" — suffixes that parse only when combined.
	for (const count of [2, 3]) {
		if (count > tokens.length) continue;
		const start = tokens.length - count;
		const first = tokens[start];
		const allowed =
			isCurrencyMarker(first) ||
			/^[+-]$/.test(first) ||
			isCreditDebitMarker(tokens[tokens.length - 1]);
		if (!allowed) continue;
		const candidate = parseAmountToken(tokens.slice(start).join(' '), currency);
		if (candidate) {
			return {
				description: trimDescription(tokens.slice(0, start)),
				amount: candidate,
				balance: null,
			};
		}
	}

	return null;
}

function buildLines(items: PositionedText[]): Line[] {
	const byPage = new Map<number, PositionedText[]>();
	for (const item of items) {
		if (!item.text.trim()) continue;
		const page = item.page ?? 0;
		const bucket = byPage.get(page) ?? [];
		bucket.push(item);
		byPage.set(page, bucket);
	}

	const lines: Line[] = [];
	for (const [page, pageItems] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
		const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);
		let current: Line | null = null;
		for (const item of sorted) {
			const height = item.height ?? 10;
			if (current && Math.abs(current.y - item.y) <= Math.max(3, height * 0.6)) {
				current.items.push(item);
			} else {
				current = { page, y: item.y, items: [item], text: '' };
				lines.push(current);
			}
		}
	}

	for (const line of lines) {
		line.items.sort((a, b) => a.x - b.x);
		line.text = lineText(line);
	}
	return lines.filter((line) => line.text.length > 0);
}

function lineText(line: Line): string {
	let text = '';
	let previous: PositionedText | null = null;
	for (const item of line.items) {
		const chunk = item.text.trim();
		if (!chunk) continue;
		if (!text) {
			text = chunk;
		} else if (previous?.width !== undefined && item.x - (previous.x + previous.width) < 1.5) {
			text += chunk;
		} else {
			text += ` ${chunk}`;
		}
		previous = item;
	}
	return text.replace(/\s+/g, ' ').trim();
}

function inferDateOrder(lines: Line[], currency: string): 'DMY' | 'MDY' {
	let dmy = 0;
	let mdy = 0;
	for (const line of lines) {
		const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(line.text);
		if (!match) continue;
		const first = Number(match[1]);
		const second = Number(match[2]);
		if (first > 12) dmy += 1;
		if (second > 12) mdy += 1;
	}
	if (dmy > mdy) return 'DMY';
	if (mdy > dmy) return 'MDY';
	// No disambiguating row: USD statements are usually month-first, others
	// day-first (LKR/AUD/GBP/EUR).
	return currency === 'USD' ? 'MDY' : 'DMY';
}

/**
 * Extract transaction rows from positioned text. Lines that do not start with
 * a recognisable date or end with a parseable amount are skipped; signs are
 * corrected from the running balance when the statement provides one.
 */
export function extractTableFromText(
	items: PositionedText[],
	opts: ExtractOptions,
): ExtractedTable {
	const defaultYear = opts.defaultYear ?? new Date().getFullYear();
	const lines = buildLines(items);
	const dateOrder = opts.dateOrder ?? inferDateOrder(lines, opts.currency);
	const exponent = minorUnitExponent(opts.currency);

	let candidates = 0;
	let skipped = 0;
	const raw: RawRow[] = [];

	/** Parse one candidate row from text that follows a date (or a section date). */
	function parseRow(isoDate: string, text: string): RawRow | null {
		const split = splitTrailingAmounts(text, opts.currency);
		if (!split) return null;

		// A separate Type column ("Credit"/"Debit") carries the sign on many
		// banking-app screenshots. Only the token immediately before the
		// amount is treated as the type column, so descriptions like
		// "credit card payment" are left intact.
		const descriptionTokens = split.description.split(/\s+/).filter(Boolean);
		let typeHint: 'credit' | 'debit' | null = null;
		const trailing = descriptionTokens[descriptionTokens.length - 1]?.toLowerCase();
		if (trailing === 'credit' || trailing === 'cr') {
			typeHint = 'credit';
			descriptionTokens.pop();
		} else if (trailing === 'debit' || trailing === 'dr') {
			typeHint = 'debit';
			descriptionTokens.pop();
		}

		const payee = cleanPayee(descriptionTokens.join(' ').replace(/\s+/g, ' ').trim());
		if (!payee) return null;

		let amount = split.amount.minor;
		const magnitude = Math.abs(amount);
		if (typeHint === 'credit') {
			amount = magnitude;
		} else if (typeHint === 'debit') {
			amount = -magnitude;
		} else if (amount > 0 && !split.amount.explicitPositive && !INCOME_HINTS.test(payee)) {
			// Statements usually print debits unsigned.
			amount = -amount;
		}
		return {
			isoDate,
			payee,
			amountMinor: amount,
			balanceMinor: split.balance ? Math.abs(split.balance.minor) : null,
		};
	}

	// Some banking apps print a date once as a section header, then list
	// transaction cards beneath it (no per-row date). Track the active section
	// date per page; a date line with no payee (e.g. a daily total) starts a
	// new section instead of becoming a row.
	let sectionDate: string | null = null;
	let currentPage = Number.NaN;

	for (const line of lines) {
		if (line.page !== currentPage) {
			currentPage = line.page;
			sectionDate = null;
		}

		const dateMatch = parseLeadingDate(line.text, dateOrder, defaultYear);
		if (dateMatch) {
			const row = parseRow(dateMatch.iso, dateMatch.rest);
			if (row) {
				candidates += 1;
				raw.push(row);
			} else {
				sectionDate = dateMatch.iso;
				skipped += 1;
			}
			continue;
		}

		if (sectionDate) {
			const row = parseRow(sectionDate, line.text);
			if (row) {
				candidates += 1;
				raw.push(row);
				continue;
			}
		}
		skipped += 1;
	}

	// Newest-first statements would invert every balance delta; normalise to
	// oldest-first for the sign check, then restore the original order.
	let ordered = raw;
	let reversed = false;
	if (raw.length >= 2 && raw[1].isoDate < raw[0].isoDate) {
		ordered = [...raw].reverse();
		reversed = true;
	}

	let previousBalance: number | null = null;
	for (const row of ordered) {
		if (row.balanceMinor !== null) {
			if (previousBalance !== null) {
				const delta = row.balanceMinor - previousBalance;
				if (delta !== 0 && Math.abs(Math.abs(delta) - Math.abs(row.amountMinor)) <= 1) {
					row.amountMinor = Math.sign(delta) * Math.abs(row.amountMinor);
				}
			}
			previousBalance = row.balanceMinor;
		}
	}

	const rows = (reversed ? [...ordered].reverse() : ordered).map((row) => ({
		Date: row.isoDate,
		Description: row.payee,
		Amount: (row.amountMinor / 10 ** exponent).toFixed(exponent),
		Balance: row.balanceMinor === null ? '' : (row.balanceMinor / 10 ** exponent).toFixed(exponent),
	}));

	return {
		headers: ['Date', 'Description', 'Amount', 'Balance'],
		rows,
		meta: {
			pages: new Set(items.map((item) => item.page ?? 0)).size || 1,
			candidates,
			skipped,
		},
	};
}

/** Concatenate extractions (multi-image OCR, multiple PDFs). */
export function mergeExtractedTables(tables: ExtractedTable[]): ExtractedTable {
	const rows = tables.flatMap((table) => table.rows);
	return {
		headers: ['Date', 'Description', 'Amount', 'Balance'],
		rows,
		meta: {
			pages: tables.reduce((sum, table) => sum + table.meta.pages, 0),
			candidates: tables.reduce((sum, table) => sum + table.meta.candidates, 0),
			skipped: tables.reduce((sum, table) => sum + table.meta.skipped, 0),
		},
	};
}

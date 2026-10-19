import { parse as papaParse } from 'papaparse';
import { minorUnitExponent } from '../engine/currency';
import type { DateFormat, DecimalStyle } from './types';

export interface ParsedCsv {
	headers: string[];
	rows: Array<Record<string, string>>;
}

/**
 * Parse a CSV document into trimmed header/value records. Header names become
 * the object keys (and therefore the values in CsvColumnMapping). Empty cells
 * are kept as empty strings; rows where every cell is blank are dropped.
 */
export function parseCsv(text: string): ParsedCsv {
	const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	const parsed = papaParse<Record<string, string>>(input, {
		header: true,
		skipEmptyLines: 'greedy',
	});
	const fields = parsed.meta.fields ?? [];
	const headers = fields.map((field) => field.trim());
	const rows = parsed.data.map((raw) => {
		const row: Record<string, string> = {};
		for (const field of fields) {
			const value = raw[field];
			row[field.trim()] = typeof value === 'string' ? value.trim() : '';
		}
		return row;
	});
	return { headers, rows };
}

const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const DAY_MONTH_YEAR = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

/** Date portion of a cell; tolerates a trailing time component. */
function datePart(raw: string): string {
	return raw.trim().split(/[T\s]/)[0] ?? '';
}

/**
 * Infer the date layout from the values themselves. Day/month order is
 * disambiguated only by a component greater than 12; ISO wins when every
 * sample is ISO. Returns 'unknown' when the samples cannot decide.
 */
export function detectDateFormat(samples: string[]): DateFormat | 'unknown' {
	const cleaned = samples.map(datePart).filter((sample) => sample !== '');
	if (cleaned.length === 0) return 'unknown';
	if (cleaned.every((sample) => ISO_DATE.test(sample))) return 'YYYY-MM-DD';

	let dayFirst = false;
	let monthFirst = false;
	for (const sample of cleaned) {
		const match = DAY_MONTH_YEAR.exec(sample);
		if (!match) continue;
		const first = Number(match[1]);
		const second = Number(match[2]);
		if (first > 12 && first <= 31 && second <= 12) dayFirst = true;
		else if (second > 12 && second <= 31 && first <= 12) monthFirst = true;
	}
	if (dayFirst && !monthFirst) return 'DD/MM/YYYY';
	if (monthFirst && !dayFirst) return 'MM/DD/YYYY';
	return 'unknown';
}

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
	const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (month === 2 && isLeapYear(year)) return 29;
	return lengths[month - 1] ?? 0;
}

/**
 * Parse a date cell into YYYY-MM-DD. Rejects impossible calendar dates
 * (2026-02-30) and missing components; single-digit days/months are fine.
 */
export function normalizeDate(raw: string, format: DateFormat): string | null {
	const text = datePart(raw);
	if (text === '') return null;

	let year: number;
	let month: number;
	let day: number;
	if (format === 'YYYY-MM-DD') {
		const match = ISO_DATE.exec(text);
		if (!match) return null;
		year = Number(match[1]);
		month = Number(match[2]);
		day = Number(match[3]);
	} else {
		const match = DAY_MONTH_YEAR.exec(text);
		if (!match) return null;
		const first = Number(match[1]);
		const second = Number(match[2]);
		year = Number(match[3]);
		if (format === 'DD/MM/YYYY') {
			day = first;
			month = second;
		} else {
			month = first;
			day = second;
		}
	}

	if (month < 1 || month > 12 || day < 1) return null;
	if (day > daysInMonth(year, month)) return null;
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const SPACES = /[\s\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;

function countChar(text: string, char: string): number {
	let count = 0;
	for (const value of text) if (value === char) count += 1;
	return count;
}

/** Digits of a grouped integer part, or null when the grouping is malformed. */
function integerDigits(raw: string, groupChar: '.' | ',' | null): string | null {
	if (raw === '') return '';
	if (/^\d+$/.test(raw)) return raw;
	if (groupChar === null) return null;
	const escaped = groupChar === '.' ? '\\.' : ',';
	const grouped = new RegExp(`^\\d{1,3}(?:${escaped}\\d{3})+$`);
	if (!grouped.test(raw)) return null;
	return raw.split(groupChar).join('');
}

/**
 * Parse a money cell into integer minor units of `currency`. Handles currency
 * prefixes (Rs, Rs., $, €), grouped thousands, decimal comma or dot, Unicode
 * minus, leading/trailing signs and accounting parentheses. Returns null when
 * no finite, representable amount can be read (never NaN).
 */
export function parseAmountToMinor(
	raw: string,
	currency: string,
	decimal: 'auto' | DecimalStyle = 'auto',
): number | null {
	if (typeof raw !== 'string') return null;
	let text = raw.trim();
	if (text === '') return null;

	let negative = false;
	const parenthesized = /^\((.*)\)$/.exec(text);
	if (parenthesized) {
		negative = true;
		text = parenthesized[1].trim();
	}

	// Drop currency words/codes together with an abbreviation dot ("Rs. 1,234").
	text = text.replace(/[A-Za-z]+\.?/g, '').trim();

	const trailingSign = /[-+\u2212\u2013]\s*$/.exec(text);
	if (trailingSign) {
		if (trailingSign[0][0] !== '+') negative = true;
		text = text.slice(0, trailingSign.index).trim();
	}
	const leadingSign = /^[+\-\u2212\u2013]\s*/.exec(text);
	if (leadingSign) {
		if (leadingSign[0][0] !== '+') negative = true;
		text = text.slice(leadingSign[0].length).trim();
	}

	text = text.replace(SPACES, '').replace(/[^0-9.,]/g, '');
	if (!/\d/.test(text)) return null;

	const lastDot = text.lastIndexOf('.');
	const lastComma = text.lastIndexOf(',');
	let decimalSep: '.' | ',' | null = null;
	if (decimal === 'dot') {
		decimalSep = '.';
	} else if (decimal === 'comma') {
		decimalSep = ',';
	} else if (lastDot >= 0 && lastComma >= 0) {
		// Last separator wins: everything to its left is grouping.
		decimalSep = lastDot > lastComma ? '.' : ',';
	} else if (lastComma >= 0) {
		const digitsAfter = text.length - lastComma - 1;
		decimalSep = countChar(text, ',') === 1 && digitsAfter >= 1 && digitsAfter <= 2 ? ',' : null;
	} else if (lastDot >= 0) {
		decimalSep = countChar(text, '.') === 1 ? '.' : null;
	}

	const decimalIndex = decimalSep ? text.lastIndexOf(decimalSep) : -1;
	const integerRaw = decimalIndex >= 0 ? text.slice(0, decimalIndex) : text;
	const fractionRaw = decimalIndex >= 0 ? text.slice(decimalIndex + 1) : '';
	if (decimalIndex >= 0 && /[.,]/.test(fractionRaw)) return null;
	if (decimalSep && integerRaw.includes(decimalSep)) return null;

	let groupChar: '.' | ',' | null = null;
	if (decimalSep === '.') groupChar = ',';
	else if (decimalSep === ',') groupChar = '.';
	else if (integerRaw.includes(',')) groupChar = ',';
	else if (integerRaw.includes('.')) groupChar = '.';
	if (groupChar && integerRaw.includes(groupChar === ',' ? '.' : ',')) return null;

	const integer = integerDigits(integerRaw, groupChar);
	if (integer === null) return null;
	if (!/^\d*$/.test(fractionRaw)) return null;
	if (integer === '' && fractionRaw === '') return null;

	const exponent = Math.max(0, minorUnitExponent(currency));
	let fraction = fractionRaw;
	let carry = 0;
	if (fraction.length > exponent) {
		const nextDigit = fraction.charCodeAt(exponent) - 48;
		fraction = fraction.slice(0, exponent);
		if (nextDigit >= 5) carry = 1;
	} else {
		fraction = fraction.padEnd(exponent, '0');
	}

	const digits = `${integer === '' ? '0' : integer}${fraction}`;
	const magnitude = BigInt(digits) + BigInt(carry);
	if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) return null;
	const amount = Number(magnitude);
	if (amount === 0) return 0;
	return negative ? -amount : amount;
}

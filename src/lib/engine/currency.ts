import type { CurrencyCode, FxRateTable, Money } from './types';

export interface CurrencyInfo {
	code: CurrencyCode;
	/** Minor-unit exponent: 2 for USD/LKR/AUD, 0 for JPY. */
	exponent: number;
	symbol: string;
	locale: string;
}

/**
 * Known currencies. Day-one requirement: LKR, USD, AUD (PLAN D5).
 * Data-driven so codes can be added freely; unknown codes fall back to
 * exponent 2 with the code itself as symbol (never a crash).
 */
export const CURRENCIES: Record<string, CurrencyInfo> = {
	LKR: { code: 'LKR', exponent: 2, symbol: 'Rs', locale: 'en-LK' },
	USD: { code: 'USD', exponent: 2, symbol: '$', locale: 'en-US' },
	AUD: { code: 'AUD', exponent: 2, symbol: 'A$', locale: 'en-AU' },
	EUR: { code: 'EUR', exponent: 2, symbol: '€', locale: 'de-DE' },
	GBP: { code: 'GBP', exponent: 2, symbol: '£', locale: 'en-GB' },
	INR: { code: 'INR', exponent: 2, symbol: '₹', locale: 'en-IN' },
	CAD: { code: 'CAD', exponent: 2, symbol: 'CA$', locale: 'en-CA' },
	CHF: { code: 'CHF', exponent: 2, symbol: 'CHF', locale: 'de-CH' },
	SGD: { code: 'SGD', exponent: 2, symbol: 'S$', locale: 'en-SG' },
	NZD: { code: 'NZD', exponent: 2, symbol: 'NZ$', locale: 'en-NZ' },
	JPY: { code: 'JPY', exponent: 0, symbol: '¥', locale: 'ja-JP' },
	MYR: { code: 'MYR', exponent: 2, symbol: 'RM', locale: 'ms-MY' },
	AED: { code: 'AED', exponent: 2, symbol: 'AED', locale: 'en-AE' },
	THB: { code: 'THB', exponent: 2, symbol: '฿', locale: 'th-TH' },
};

export function isKnownCurrency(code: CurrencyCode): boolean {
	return code in CURRENCIES;
}

export function currencyInfo(code: CurrencyCode): CurrencyInfo {
	return CURRENCIES[code] ?? { code, exponent: 2, symbol: code, locale: 'en-US' };
}

export function minorUnitExponent(code: CurrencyCode): number {
	return currencyInfo(code).exponent;
}

export function money(minorUnits: number, currency: CurrencyCode): Money {
	return { minorUnits, currency };
}

export interface FormatMoneyOptions {
	locale?: string;
	/** 'symbol' (Rs, $) or 'code' (LKR, USD). */
	display?: 'symbol' | 'code';
	/** Prefix '+' for positive amounts (negatives always get '-'). */
	signed?: boolean;
}

/** Format via Intl; degrades gracefully for unknown locales/currencies. */
export function formatMoney(m: Money, opts: FormatMoneyOptions = {}): string {
	const info = currencyInfo(m.currency);
	const locale = opts.locale ?? info.locale;
	const currencyDisplay = opts.display === 'code' ? 'code' : 'narrowSymbol';
	let text: string;
	try {
		text = new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: m.currency,
			currencyDisplay,
		}).format(m.minorUnits / 10 ** info.exponent);
	} catch {
		text = `${m.minorUnits / 10 ** info.exponent} ${m.currency}`;
	}
	if (opts.signed && m.minorUnits > 0) text = `+${text}`;
	return text;
}

/**
 * Convert using an explicit, dated rate table. Returns undefined when no rate
 * is available — callers must surface that (missingRates), never guess.
 * Rates are MAJOR-unit ratios: units of table.base per 1 unit of currency.
 */
export function convertMoney(m: Money, table: FxRateTable): Money | undefined {
	if (m.currency === table.base) return m;
	const rate = table.rates[m.currency];
	if (rate === undefined || !Number.isFinite(rate)) return undefined;
	const fromExp = minorUnitExponent(m.currency);
	const toExp = minorUnitExponent(table.base);
	const major = m.minorUnits / 10 ** fromExp;
	return { minorUnits: Math.round(major * rate * 10 ** toExp), currency: table.base };
}

/** Per-currency totals — the honest answer before any conversion. */
export function sumByCurrency(moneys: Money[]): Record<CurrencyCode, number> {
	const totals: Record<CurrencyCode, number> = {};
	for (const m of moneys) {
		totals[m.currency] = (totals[m.currency] ?? 0) + m.minorUnits;
	}
	return totals;
}

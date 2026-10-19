import { minorUnitExponent } from '$lib/engine/currency';

/**
 * Parse a user-typed major-unit amount ('1,234.56', '1 234,56', '(20)',
 * '-20', 'Rs 1,500') into integer minor units for a currency.
 * Returns null when the text is not a valid amount.
 */
export function parseUserAmount(input: string, currency: string): number | null {
	let text = input.trim();
	if (!text) return null;
	let negative = false;
	if (/^\(.*\)$/.test(text)) {
		negative = true;
		text = text.slice(1, -1);
	}
	text = text.replace(/[^\d.,+-]/g, '');
	if (text.startsWith('-')) {
		negative = !negative;
		text = text.slice(1);
	} else if (text.startsWith('+')) {
		text = text.slice(1);
	}
	if (!text) return null;

	const exponent = minorUnitExponent(currency);
	const lastComma = text.lastIndexOf(',');
	const lastDot = text.lastIndexOf('.');
	let decimalSep: string | null = null;
	if (lastComma >= 0 && lastDot >= 0) decimalSep = lastComma > lastDot ? ',' : '.';
	else if (lastComma >= 0) decimalSep = ',';
	else if (lastDot >= 0) decimalSep = '.';

	let integerPart = text;
	let fractionPart = '';
	if (decimalSep) {
		const index = text.lastIndexOf(decimalSep);
		integerPart = text.slice(0, index).replace(/[.,]/g, '');
		fractionPart = text.slice(index + 1).replace(/[.,]/g, '');
	} else {
		integerPart = text.replace(/[.,]/g, '');
	}

	// '1.234' / '1,234' with exactly three trailing digits and no other
	// separator is a thousands grouping, not a fraction.
	if (decimalSep && fractionPart.length === 3 && !integerPart.includes('.')) {
		const whole = `${integerPart}${fractionPart}`;
		if (!/^\d+$/.test(whole)) return null;
		const minor = Number(whole) * 10 ** exponent;
		return Number.isSafeInteger(minor) ? (negative ? -minor : minor) : null;
	}

	if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null;
	const major = Number(`${integerPart || '0'}.${fractionPart || '0'}`);
	if (!Number.isFinite(major)) return null;
	const minor = Math.round(major * 10 ** exponent);
	if (!Number.isSafeInteger(minor)) return null;
	return negative ? -minor : minor;
}

/** Major-unit text for an input field (no grouping, fixed decimals). */
export function toMajorInput(minor: number, currency: string): string {
	const exponent = minorUnitExponent(currency);
	return (minor / 10 ** exponent).toFixed(exponent);
}

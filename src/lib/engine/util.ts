/**
 * Shared pure helpers. No Svelte, no DOM, no node APIs — safe in workers.
 */

/** UUID v4 via WebCrypto; timestamp-ordered fallback keeps ids unique offline. */
export function newId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
	return new Date().toISOString();
}

/** Local calendar date as YYYY-MM-DD (ledger dates are calendar dates). */
export function isoDateString(date: Date): string {
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, '0');
	const d = `${date.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function todayIso(): string {
	return isoDateString(new Date());
}

/** 'YYYY-MM' from an ISO date string. */
export function monthKeyOf(isoDate: string): string {
	return isoDate.slice(0, 7);
}

/**
 * Canonical payee-matching key: uppercase, alphanumeric only.
 * 'SQ *BLUE BOTTLE #412' → 'SQBLUEBOTTLE412'. Used by payee memory, rules
 * matching helpers, and import dedupe so all three agree on "same payee".
 */
export function normalizePayeeKey(payee: string): string {
	return payee.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

export function addMonths(monthKey: string, delta: number): string {
	const [y, m] = monthKey.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, '0')}`;
}

/** Day-of-month for the last day of a month key, e.g. addMonths → '2026-02' → 28. */
export function daysInMonth(monthKey: string): number {
	const [y, m] = monthKey.split('-').map(Number);
	return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

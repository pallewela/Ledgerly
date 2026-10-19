/**
 * Import pipeline contracts. The UI builds a CsvColumnMapping from the CSV
 * headers, builds an ImportPlan for preview, then commits the plan through
 * EngineApi (see commit.ts).
 */

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export type DecimalStyle = 'dot' | 'comma';

/**
 * Maps CSV header names to ledger fields. `amount` is a single signed column;
 * `debit`/`credit` are the alternative. Amount values in `debit` are treated
 * as outflows (negated), `credit` values as inflows.
 */
export interface CsvColumnMapping {
	date: string;
	payee: string;
	amount?: string;
	debit?: string;
	credit?: string;
	balance?: string;
	dateFormat?: 'auto' | DateFormat;
	decimal?: 'auto' | DecimalStyle;
}

export interface ImportRow {
	/** 0-based index into the parsed CSV data rows. */
	index: number;
	/** Normalized YYYY-MM-DD, or '' when the date could not be read. */
	date: string;
	payee: string;
	/** Signed minor units; 0 when the row has issues. */
	amountMinor: number;
	balanceMinor: number | null;
	/** Human-readable problems. Empty means the row is importable. */
	issues: string[];
	/**
	 * Existing transaction id, or `plan:<index>` when a later row duplicates an
	 * earlier row in the same plan.
	 */
	duplicateOf: string | null;
}

export interface ImportPlan {
	accountId: string;
	currency: string;
	rows: ImportRow[];
	/**
	 * `valid` counts issue-free rows; `duplicates` is a subset of `valid`
	 * (issue-free rows flagged with duplicateOf); `errors` counts rows with
	 * issues. valid + errors === total.
	 */
	summary: { total: number; valid: number; duplicates: number; errors: number };
}

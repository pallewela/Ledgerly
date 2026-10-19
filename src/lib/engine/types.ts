/**
 * Ledgerly — domain contracts (frozen at Gate G1, PLAN.md §6 S1).
 *
 * Single source of truth shared by every module:
 *   engine   — implements EngineApi (api.ts) over any LedgerRepository
 *   storage  — IndexedDB implementation of LedgerRepository + snapshots
 *   import   — parsing → ImportPlan → commit through EngineApi (type-only dep)
 *   app/routes — Svelte UI consumes EngineApi only, never storage directly
 *
 * MONEY RULES (PRD FR-1.7 / NFR-7, PLAN A5):
 *   - Every amount is an INTEGER number of MINOR UNITS in the account's own
 *     currency. Never floats. Exponents come from currency.ts (ISO 4217).
 *   - Transactions are signed in ACCOUNT DIRECTION: positive = money into the
 *     account (deposit, income, transfer in); negative = money out (purchase,
 *     withdrawal, fee, transfer out).
 *   - Account balance = anchor + Σ signed amounts dated AFTER the anchor,
 *     where the anchor is the opening balance or the latest BalanceSnapshot
 *     on or before the requested date.
 *   - Credit cards / loans therefore carry negative balances (debt).
 *   - NO silent currency conversion. Conversion happens only at the report
 *     layer (netWorth / monthSummary / budgetStatus) with an explicit, dated
 *     FxRateTable, and missing rates are reported, never guessed.
 */

export type CurrencyCode = string; // ISO 4217 — see currency.ts for the known table

export type AccountType =
	'checking' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'mortgage' | 'asset';

export interface Account {
	id: string;
	name: string;
	/** Free text, e.g. "BOC" or "Chase". Optional. */
	institution: string | null;
	type: AccountType;
	currency: CurrencyCode;
	/** Signed opening balance in the account's currency, minor units. */
	openingBalanceMinor: number;
	/** When false, the account is tracked but excluded from net worth. */
	includeInNetWorth: boolean;
	/** ISO timestamp or null while active. */
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * A manual balance anchor (FR-1.3). Compute balance from the latest snapshot
 * on or before the target date instead of the opening balance when present.
 */
export interface BalanceSnapshot {
	id: string;
	accountId: string;
	/** ISO date (YYYY-MM-DD) the anchor applies to (inclusive). */
	date: string;
	balanceMinor: number;
	note: string | null;
	createdAt: string;
}

export type CategoryKind = 'income' | 'expense' | 'transfer' | 'savings';

export interface Category {
	id: string;
	name: string;
	/** Parent category id or null for top level. Max two levels (FR-4.1). */
	parentId: string | null;
	kind: CategoryKind;
	archivedAt: string | null;
	sortOrder: number;
}

export interface Transaction {
	id: string;
	accountId: string;
	/** ISO date YYYY-MM-DD. */
	date: string;
	/** Raw display payee (kept as imported/entered). */
	payee: string;
	/** Signed, account direction, minor units of the ACCOUNT's currency. */
	amountMinor: number;
	categoryId: string | null;
	note: string | null;
	tags: string[];
	/** Both legs of an internal transfer share one transferId. */
	transferId: string | null;
	/** Set when the row came from an import batch (undo support). */
	importBatchId: string | null;
	source: 'manual' | 'import' | 'receipt';
	createdAt: string;
	updatedAt: string;
}

/** A category assignment for part of a transaction (FR-2.2). */
export interface Split {
	id: string;
	transactionId: string;
	categoryId: string;
	/** Signed, same sign as the parent transaction. */
	amountMinor: number;
	note: string | null;
}

export interface RuleMatch {
	/** Case-insensitive substring match against the payee. */
	payeeContains: string;
	amountMinMinor?: number;
	amountMaxMinor?: number;
	accountId?: string;
}

export interface RuleAction {
	categoryId: string;
	renamePayee?: string;
	addTags?: string[];
}

export interface Rule {
	id: string;
	/** Lower priority number runs first; first match wins. */
	priority: number;
	match: RuleMatch;
	action: RuleAction;
	enabled: boolean;
	createdAt: string;
}

/** Learned mapping: normalized payee on an account → category (FR-3.8). */
export interface PayeeMemoryEntry {
	/** normalizePayeeKey(payee) + '|' + accountId — see util.ts */
	key: string;
	/** Last-seen display form of the payee. */
	payee: string;
	accountId: string;
	categoryId: string;
	useCount: number;
	lastUsedAt: string;
}

/** Budgets are denominated in the user's BASE currency (see api.ts notes). */
export interface Budget {
	id: string;
	/** 'YYYY-MM' */
	month: string;
	categoryId: string;
	limitMinor: number;
	rollover: boolean;
}

export interface Bill {
	id: string;
	name: string;
	/** null = variable amount. */
	amountMinor: number | null;
	/** Day of month, 1–31. */
	dueDay: number;
	accountId: string | null;
	archivedAt: string | null;
	lastPaidAt: string | null;
}

export interface ImportBatch {
	id: string;
	createdAt: string;
	source: 'csv' | 'pdf' | 'screenshot' | 'receipt' | 'restore';
	label: string;
	accountId: string | null;
	rowsTotal: number;
	rowsImported: number;
	rowsSkipped: number;
}

/**
 * FX rates are ALWAYS explicit and dated (never ambient, never guessed).
 * rate = units of `base` per 1 unit (major) of the keyed currency.
 */
export interface FxRateTable {
	base: CurrencyCode;
	/** ISO date the rates were fetched. */
	asOf: string;
	rates: Record<CurrencyCode, number>;
}

export interface Money {
	readonly minorUnits: number;
	readonly currency: CurrencyCode;
}

export interface TxFilter {
	accountIds?: string[];
	/** Inclusive ISO date. */
	from?: string;
	/** Inclusive ISO date. */
	to?: string;
	/** undefined = any; null = only uncategorized; string = exact match. */
	categoryId?: string | null;
	payeeContains?: string;
	minAmountMinor?: number;
	maxAmountMinor?: number;
	/** undefined = any; true = only transfer legs; false = only non-transfers. */
	hasTransfer?: boolean;
	limit?: number;
}

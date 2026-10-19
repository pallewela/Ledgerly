import type { LedgerRepository } from './repository';
import type {
	Account,
	AccountType,
	BalanceSnapshot,
	Bill,
	Budget,
	Category,
	CategoryKind,
	CurrencyCode,
	FxRateTable,
	ImportBatch,
	Rule,
	Split,
	Transaction,
	TxFilter,
} from './types';

/**
 * EngineApi — the frozen facade every consumer (UI, import commit, tests)
 * programs against. Implemented in engine.ts (Stage 2 build-out).
 *
 * BUDGET CURRENCY: budgets are denominated in the user's BASE currency.
 * Spending that spans account currencies is converted with the same explicit
 * FxRateTable used by reports; unavailable rates surface via missingRates.
 */

export interface AccountInput {
	name: string;
	type: AccountType;
	currency: CurrencyCode;
	institution?: string | null;
	openingBalanceMinor: number;
	includeInNetWorth?: boolean;
}

export interface TransactionInput {
	accountId: string;
	/** ISO date YYYY-MM-DD. */
	date: string;
	payee: string;
	/** Signed, account direction, minor units of the account's currency. */
	amountMinor: number;
	categoryId?: string | null;
	note?: string | null;
	tags?: string[];
	/** When set, a paired leg is created on the peer account (same amount, opposite sign). */
	transferToAccountId?: string;
	source?: Transaction['source'];
	importBatchId?: string | null;
}

export interface NewSplit {
	categoryId: string;
	amountMinor: number;
	note?: string | null;
}

export interface NetWorthReport {
	asOf: string;
	base: CurrencyCode;
	fx: FxRateTable;
	accounts: Array<{
		account: Account;
		balanceMinor: number;
		balanceInBaseMinor: number | null; // null = rate unavailable
	}>;
	perCurrency: Array<{ currency: CurrencyCode; totalMinor: number }>;
	totalInBaseMinor: number;
	missingRates: CurrencyCode[];
}

export interface MonthSummary {
	month: string; // 'YYYY-MM'
	base: CurrencyCode;
	fx: FxRateTable;
	incomeInBaseMinor: number;
	expenseInBaseMinor: number;
	netInBaseMinor: number;
	byCategory: Array<{
		categoryId: string | null;
		kind: CategoryKind | null;
		totalInBaseMinor: number; // income +, expense −
	}>;
	missingRates: CurrencyCode[];
}

export type BudgetPace = 'under' | 'on-pace' | 'projected-over' | 'over';

export interface BudgetStatus {
	month: string;
	base: CurrencyCode;
	byCategory: Array<{
		categoryId: string;
		limitMinor: number;
		spentInBaseMinor: number;
		remainingMinor: number;
		pace: BudgetPace;
	}>;
	missingRates: CurrencyCode[];
}

export interface CategorySuggestion {
	categoryId: string | null;
	source: 'rule' | 'payee-memory' | 'none';
	/** Human-readable, shown in the UI (PRD: every automated decision explainable). */
	reason: string;
}

export interface TransferPair {
	a: Transaction;
	b: Transaction;
}

export interface EngineApi {
	// ---- Accounts
	createAccount(input: AccountInput): Promise<Account>;
	updateAccount(id: string, patch: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account>;
	archiveAccount(id: string, archived: boolean): Promise<void>;
	listAccounts(opts?: { includeArchived?: boolean }): Promise<Account[]>;

	/**
	 * Signed balance of the account in its own currency at end of `asOf`
	 * (inclusive), anchored on the latest BalanceSnapshot on or before asOf
	 * when one exists, else the opening balance.
	 */
	computeBalance(accountId: string, asOf?: string): Promise<number>;
	recordBalanceSnapshot(
		accountId: string,
		date: string,
		balanceMinor: number,
		note?: string | null,
	): Promise<BalanceSnapshot>;
	listBalanceSnapshots(accountId?: string): Promise<BalanceSnapshot[]>;

	// ---- Transactions
	addTransaction(input: TransactionInput): Promise<Transaction>;
	updateTransaction(
		id: string,
		patch: Partial<Omit<Transaction, 'id' | 'createdAt' | 'accountId'>>,
	): Promise<Transaction>;
	deleteTransaction(id: string): Promise<void>; // removes the paired transfer leg too
	getTransaction(id: string): Promise<Transaction | undefined>;
	listTransactions(filter?: TxFilter): Promise<Transaction[]>;

	/** Replace the category assignment of a transaction with explicit parts. */
	splitTransaction(id: string, parts: NewSplit[]): Promise<Transaction>;
	listSplitsForTransaction(transactionId: string): Promise<Split[]>;

	// ---- Transfers
	/** Unpaired transactions that look like two legs of an internal transfer. */
	suggestTransferPairs(opts?: { windowDays?: number }): Promise<TransferPair[]>;
	/** Link two existing transactions as transfer legs; returns the transferId. */
	pairAsTransfer(aId: string, bId: string): Promise<string>;
	unpairTransfer(transferId: string): Promise<void>;

	// ---- Categories
	createCategory(input: {
		name: string;
		kind: CategoryKind;
		parentId?: string | null;
		sortOrder?: number;
	}): Promise<Category>;
	updateCategory(id: string, patch: Partial<Omit<Category, 'id'>>): Promise<Category>;
	archiveCategory(id: string, archived: boolean): Promise<void>;
	listCategories(opts?: { includeArchived?: boolean }): Promise<Category[]>;

	// ---- Rules
	createRule(match: Rule['match'], action: Rule['action'], priority?: number): Promise<Rule>;
	updateRule(id: string, patch: Partial<Omit<Rule, 'id' | 'createdAt'>>): Promise<Rule>;
	deleteRule(id: string): Promise<void>;
	listRules(): Promise<Rule[]>; // priority asc
	/** Apply the first matching enabled rule; returns the (possibly) updated tx. */
	applyRulesToTransaction(tx: Transaction): Promise<Transaction>;
	/** Dry-run rules against existing transactions for the preview tester (FR-4.3). */
	previewRules(days: number): Promise<Array<{ tx: Transaction; matchedRule: Rule | null }>>;

	// ---- Payee memory (FR-3.8 teachable corrections)
	rememberPayeeChoice(payee: string, accountId: string, categoryId: string): Promise<void>;
	suggestCategory(payee: string, accountId: string): Promise<CategorySuggestion>;

	// ---- Budgets & bills
	setBudget(
		month: string,
		categoryId: string,
		limitMinor: number,
		rollover?: boolean,
	): Promise<Budget>;
	deleteBudget(id: string): Promise<void>;
	listBudgets(month?: string): Promise<Budget[]>;
	budgetStatus(month: string, fx: FxRateTable): Promise<BudgetStatus>;

	createBill(input: Omit<Bill, 'id' | 'archivedAt' | 'lastPaidAt'>): Promise<Bill>;
	updateBill(id: string, patch: Partial<Omit<Bill, 'id'>>): Promise<Bill>;
	deleteBill(id: string): Promise<void>;
	listBills(opts?: { includeArchived?: boolean }): Promise<Bill[]>;
	upcomingBills(days: number, from?: string): Promise<Array<{ bill: Bill; dueDate: string }>>;
	markBillPaid(billId: string, tx: TransactionInput): Promise<Transaction>;

	// ---- Reports
	netWorth(asOf: string, base: CurrencyCode, fx: FxRateTable): Promise<NetWorthReport>;
	monthSummary(month: string, base: CurrencyCode, fx: FxRateTable): Promise<MonthSummary>;

	// ---- Import support
	recordImportBatch(batch: Omit<ImportBatch, 'id' | 'createdAt'>): Promise<ImportBatch>;
	undoImportBatch(batchId: string): Promise<number>; // deletes its txs, returns count
	listImportBatches(): Promise<ImportBatch[]>;
}

/** Construction signature implemented in engine.ts. */
export type EngineFactory = (repo: LedgerRepository, clock?: () => Date) => EngineApi;

import type {
	Account,
	BalanceSnapshot,
	Bill,
	Budget,
	Category,
	ImportBatch,
	PayeeMemoryEntry,
	Rule,
	Split,
	Transaction,
	TxFilter,
} from './types';

/**
 * Persistence-agnostic storage contract. All methods async because the
 * production implementation (IndexedDB) is; tests use MemoryRepository.
 *
 * The repository is DUMB STORAGE: no cascade deletes, no domain rules.
 * Orchestration (e.g. deleting a transfer's paired leg) lives in the engine.
 * Implementations must be atomic per call (NFR-2: no partially-written state).
 */
export interface LedgerRepository {
	// Accounts
	listAccounts(includeArchived?: boolean): Promise<Account[]>;
	getAccount(id: string): Promise<Account | undefined>;
	putAccount(account: Account): Promise<void>; // upsert
	deleteAccount(id: string): Promise<void>;

	// Balance snapshots
	listBalanceSnapshots(accountId?: string): Promise<BalanceSnapshot[]>;
	putBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void>;
	deleteBalanceSnapshot(id: string): Promise<void>;

	// Transactions
	listTransactions(filter?: TxFilter): Promise<Transaction[]>;
	getTransaction(id: string): Promise<Transaction | undefined>;
	putTransaction(tx: Transaction): Promise<void>; // upsert
	deleteTransaction(id: string): Promise<void>;

	// Splits
	listSplitsForTransaction(transactionId: string): Promise<Split[]>;
	listAllSplits(): Promise<Split[]>;
	putSplit(split: Split): Promise<void>;
	deleteSplitsForTransaction(transactionId: string): Promise<void>;

	// Categories
	listCategories(includeArchived?: boolean): Promise<Category[]>;
	putCategory(category: Category): Promise<void>;
	deleteCategory(id: string): Promise<void>;

	// Rules
	listRules(): Promise<Rule[]>; // sorted by priority asc
	putRule(rule: Rule): Promise<void>;
	deleteRule(id: string): Promise<void>;

	// Payee memory
	listPayeeMemory(): Promise<PayeeMemoryEntry[]>;
	putPayeeMemory(entry: PayeeMemoryEntry): Promise<void>;
	deletePayeeMemory(key: string): Promise<void>;

	// Budgets
	listBudgets(month?: string): Promise<Budget[]>;
	putBudget(budget: Budget): Promise<void>;
	deleteBudget(id: string): Promise<void>;

	// Bills
	listBills(includeArchived?: boolean): Promise<Bill[]>;
	putBill(bill: Bill): Promise<void>;
	deleteBill(id: string): Promise<void>;

	// Import batches
	listImportBatches(): Promise<ImportBatch[]>;
	putImportBatch(batch: ImportBatch): Promise<void>;
	deleteImportBatch(id: string): Promise<void>;

	// Settings (simple typed key-value; app-level, not domain rules)
	getSetting<T>(key: string): Promise<T | undefined>;
	putSetting(key: string, value: unknown): Promise<void>;
	deleteSetting(key: string): Promise<void>;

	/** Hard-delete EVERYTHING (FR-8.6 delete-all, restore replace mode). */
	clear(): Promise<void>;
}

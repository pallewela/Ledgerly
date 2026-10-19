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
import type { LedgerRepository } from './repository';

/**
 * In-memory LedgerRepository. Used by every unit test, by the app bootstrap
 * fallback, and as the reference semantics for the IndexedDB implementation.
 */
export class MemoryRepository implements LedgerRepository {
	private accounts = new Map<string, Account>();
	private balanceSnapshots = new Map<string, BalanceSnapshot>();
	private transactions = new Map<string, Transaction>();
	private splits = new Map<string, Split>();
	private categories = new Map<string, Category>();
	private rules = new Map<string, Rule>();
	private payeeMemory = new Map<string, PayeeMemoryEntry>();
	private budgets = new Map<string, Budget>();
	private bills = new Map<string, Bill>();
	private importBatches = new Map<string, ImportBatch>();
	private settings = new Map<string, unknown>();

	// Accounts
	async listAccounts(includeArchived = false): Promise<Account[]> {
		return [...this.accounts.values()].filter((a) => includeArchived || a.archivedAt === null);
	}
	async getAccount(id: string): Promise<Account | undefined> {
		return this.accounts.get(id);
	}
	async putAccount(account: Account): Promise<void> {
		this.accounts.set(account.id, { ...account });
	}
	async deleteAccount(id: string): Promise<void> {
		this.accounts.delete(id);
	}

	// Balance snapshots
	async listBalanceSnapshots(accountId?: string): Promise<BalanceSnapshot[]> {
		return [...this.balanceSnapshots.values()]
			.filter((s) => !accountId || s.accountId === accountId)
			.sort((a, b) => a.date.localeCompare(b.date));
	}
	async putBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void> {
		this.balanceSnapshots.set(snapshot.id, { ...snapshot });
	}
	async deleteBalanceSnapshot(id: string): Promise<void> {
		this.balanceSnapshots.delete(id);
	}

	// Transactions
	async listTransactions(filter: TxFilter = {}): Promise<Transaction[]> {
		let rows = [...this.transactions.values()];
		if (filter.accountIds) {
			const ids = new Set(filter.accountIds);
			rows = rows.filter((t) => ids.has(t.accountId));
		}
		if (filter.from !== undefined) rows = rows.filter((t) => t.date >= filter.from!);
		if (filter.to !== undefined) rows = rows.filter((t) => t.date <= filter.to!);
		if (filter.categoryId !== undefined) {
			rows = rows.filter((t) => t.categoryId === filter.categoryId);
		}
		if (filter.payeeContains !== undefined) {
			const needle = filter.payeeContains.toLowerCase();
			rows = rows.filter((t) => t.payee.toLowerCase().includes(needle));
		}
		if (filter.minAmountMinor !== undefined) {
			rows = rows.filter((t) => t.amountMinor >= filter.minAmountMinor!);
		}
		if (filter.maxAmountMinor !== undefined) {
			rows = rows.filter((t) => t.amountMinor <= filter.maxAmountMinor!);
		}
		if (filter.hasTransfer !== undefined) {
			rows = rows.filter((t) =>
				filter.hasTransfer ? t.transferId !== null : t.transferId === null,
			);
		}
		rows.sort((a, b) =>
			a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
		);
		return filter.limit !== undefined ? rows.slice(0, filter.limit) : rows;
	}
	async getTransaction(id: string): Promise<Transaction | undefined> {
		return this.transactions.get(id);
	}
	async putTransaction(tx: Transaction): Promise<void> {
		this.transactions.set(tx.id, { ...tx, tags: [...tx.tags] });
	}
	async deleteTransaction(id: string): Promise<void> {
		this.transactions.delete(id);
	}

	// Splits
	async listSplitsForTransaction(transactionId: string): Promise<Split[]> {
		return [...this.splits.values()].filter((s) => s.transactionId === transactionId);
	}
	async listAllSplits(): Promise<Split[]> {
		return [...this.splits.values()];
	}
	async putSplit(split: Split): Promise<void> {
		this.splits.set(split.id, { ...split });
	}
	async deleteSplitsForTransaction(transactionId: string): Promise<void> {
		for (const [id, s] of this.splits) {
			if (s.transactionId === transactionId) this.splits.delete(id);
		}
	}

	// Categories
	async listCategories(includeArchived = false): Promise<Category[]> {
		return [...this.categories.values()]
			.filter((c) => includeArchived || c.archivedAt === null)
			.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
	}
	async putCategory(category: Category): Promise<void> {
		this.categories.set(category.id, { ...category });
	}
	async deleteCategory(id: string): Promise<void> {
		this.categories.delete(id);
	}

	// Rules
	async listRules(): Promise<Rule[]> {
		return [...this.rules.values()].sort(
			(a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt),
		);
	}
	async putRule(rule: Rule): Promise<void> {
		this.rules.set(rule.id, { ...rule });
	}
	async deleteRule(id: string): Promise<void> {
		this.rules.delete(id);
	}

	// Payee memory
	async listPayeeMemory(): Promise<PayeeMemoryEntry[]> {
		return [...this.payeeMemory.values()];
	}
	async putPayeeMemory(entry: PayeeMemoryEntry): Promise<void> {
		this.payeeMemory.set(entry.key, { ...entry });
	}
	async deletePayeeMemory(key: string): Promise<void> {
		this.payeeMemory.delete(key);
	}

	// Budgets
	async listBudgets(month?: string): Promise<Budget[]> {
		return [...this.budgets.values()].filter((b) => !month || b.month === month);
	}
	async putBudget(budget: Budget): Promise<void> {
		this.budgets.set(budget.id, { ...budget });
	}
	async deleteBudget(id: string): Promise<void> {
		this.budgets.delete(id);
	}

	// Bills
	async listBills(includeArchived = false): Promise<Bill[]> {
		return [...this.bills.values()].filter((b) => includeArchived || b.archivedAt === null);
	}
	async putBill(bill: Bill): Promise<void> {
		this.bills.set(bill.id, { ...bill });
	}
	async deleteBill(id: string): Promise<void> {
		this.bills.delete(id);
	}

	// Import batches
	async listImportBatches(): Promise<ImportBatch[]> {
		return [...this.importBatches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}
	async putImportBatch(batch: ImportBatch): Promise<void> {
		this.importBatches.set(batch.id, { ...batch });
	}
	async deleteImportBatch(id: string): Promise<void> {
		this.importBatches.delete(id);
	}

	// Settings
	async getSetting<T>(key: string): Promise<T | undefined> {
		return this.settings.get(key) as T | undefined;
	}
	async putSetting(key: string, value: unknown): Promise<void> {
		this.settings.set(key, value);
	}
	async deleteSetting(key: string): Promise<void> {
		this.settings.delete(key);
	}

	async clear(): Promise<void> {
		this.accounts.clear();
		this.balanceSnapshots.clear();
		this.transactions.clear();
		this.splits.clear();
		this.categories.clear();
		this.rules.clear();
		this.payeeMemory.clear();
		this.budgets.clear();
		this.bills.clear();
		this.importBatches.clear();
		this.settings.clear();
	}
}

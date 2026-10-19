import Dexie, { type Table } from 'dexie';
import type { LedgerRepository } from '../engine/repository';
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
} from '../engine/types';

/** One row of the `settings` table: the setting name plus its stored payload. */
interface SettingRow {
	key: string;
	value: unknown;
}

/**
 * Dexie schema for the single Ledgerly database.
 *
 * One table per entity. Primary keys are the domain ids, except `settings`
 * (keyed by the setting name) and `payeeMemory` (keyed by the
 * `normalizePayeeKey(payee)|accountId` key used by the engine).
 *
 * Only primary keys are indexed: dataset sizes are small (≤25k transactions)
 * and the repository filters/sorts in JS to match MemoryRepository exactly,
 * so secondary indexes would add write cost without buying anything.
 */
class LedgerlyDatabase extends Dexie {
	accounts!: Table<Account, string>;
	balanceSnapshots!: Table<BalanceSnapshot, string>;
	transactions!: Table<Transaction, string>;
	splits!: Table<Split, string>;
	categories!: Table<Category, string>;
	rules!: Table<Rule, string>;
	payeeMemory!: Table<PayeeMemoryEntry, string>;
	budgets!: Table<Budget, string>;
	bills!: Table<Bill, string>;
	importBatches!: Table<ImportBatch, string>;
	settings!: Table<SettingRow, string>;

	constructor(name: string) {
		super(name);
		this.version(1).stores({
			accounts: 'id',
			balanceSnapshots: 'id',
			transactions: 'id',
			splits: 'id',
			categories: 'id',
			rules: 'id',
			payeeMemory: 'key',
			budgets: 'id',
			bills: 'id',
			importBatches: 'id',
			settings: 'key',
		});
	}
}

/**
 * IndexedDB-backed LedgerRepository (Dexie).
 *
 * Semantics mirror `MemoryRepository` — it is the reference implementation —
 * including archive flags, sort orders, and filter edge cases
 * (`categoryId: null` means only uncategorized rows).
 *
 * Every method is atomic on its own (Dexie request/transaction), per the
 * repository contract; cross-entity orchestration stays in the engine.
 */
export class IndexedDbRepository implements LedgerRepository {
	private readonly db: LedgerlyDatabase;

	constructor(dbName: string) {
		this.db = new LedgerlyDatabase(dbName);
	}

	/** Close the connection. Needed before `indexedDB.deleteDatabase()` in teardown. */
	close(): void {
		this.db.close();
	}

	// Accounts
	async listAccounts(includeArchived = false): Promise<Account[]> {
		const rows = await this.db.accounts.toArray();
		return rows.filter((a) => includeArchived || a.archivedAt === null);
	}

	async getAccount(id: string): Promise<Account | undefined> {
		return this.db.accounts.get(id);
	}

	async putAccount(account: Account): Promise<void> {
		await this.db.accounts.put({ ...account });
	}

	async deleteAccount(id: string): Promise<void> {
		await this.db.accounts.delete(id);
	}

	// Balance snapshots
	async listBalanceSnapshots(accountId?: string): Promise<BalanceSnapshot[]> {
		const rows = await this.db.balanceSnapshots.toArray();
		return rows
			.filter((s) => !accountId || s.accountId === accountId)
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	async putBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void> {
		await this.db.balanceSnapshots.put({ ...snapshot });
	}

	async deleteBalanceSnapshot(id: string): Promise<void> {
		await this.db.balanceSnapshots.delete(id);
	}

	// Transactions
	async listTransactions(filter: TxFilter = {}): Promise<Transaction[]> {
		let rows = await this.db.transactions.toArray();
		if (filter.accountIds) {
			const ids = new Set(filter.accountIds);
			rows = rows.filter((t) => ids.has(t.accountId));
		}
		if (filter.from !== undefined) {
			const from = filter.from;
			rows = rows.filter((t) => t.date >= from);
		}
		if (filter.to !== undefined) {
			const to = filter.to;
			rows = rows.filter((t) => t.date <= to);
		}
		if (filter.categoryId !== undefined) {
			const categoryId = filter.categoryId;
			rows = rows.filter((t) => t.categoryId === categoryId);
		}
		if (filter.payeeContains !== undefined) {
			const needle = filter.payeeContains.toLowerCase();
			rows = rows.filter((t) => t.payee.toLowerCase().includes(needle));
		}
		if (filter.minAmountMinor !== undefined) {
			const min = filter.minAmountMinor;
			rows = rows.filter((t) => t.amountMinor >= min);
		}
		if (filter.maxAmountMinor !== undefined) {
			const max = filter.maxAmountMinor;
			rows = rows.filter((t) => t.amountMinor <= max);
		}
		if (filter.hasTransfer !== undefined) {
			const hasTransfer = filter.hasTransfer;
			rows = rows.filter((t) => (hasTransfer ? t.transferId !== null : t.transferId === null));
		}
		rows.sort((a, b) =>
			a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
		);
		return filter.limit !== undefined ? rows.slice(0, filter.limit) : rows;
	}

	async getTransaction(id: string): Promise<Transaction | undefined> {
		return this.db.transactions.get(id);
	}

	async putTransaction(tx: Transaction): Promise<void> {
		await this.db.transactions.put({ ...tx, tags: [...tx.tags] });
	}

	async deleteTransaction(id: string): Promise<void> {
		await this.db.transactions.delete(id);
	}

	// Splits
	async listSplitsForTransaction(transactionId: string): Promise<Split[]> {
		const rows = await this.db.splits.toArray();
		return rows.filter((s) => s.transactionId === transactionId);
	}

	async listAllSplits(): Promise<Split[]> {
		return this.db.splits.toArray();
	}

	async putSplit(split: Split): Promise<void> {
		await this.db.splits.put({ ...split });
	}

	async deleteSplitsForTransaction(transactionId: string): Promise<void> {
		const rows = await this.db.splits.toArray();
		const ids = rows.filter((s) => s.transactionId === transactionId).map((s) => s.id);
		if (ids.length > 0) await this.db.splits.bulkDelete(ids);
	}

	// Categories
	async listCategories(includeArchived = false): Promise<Category[]> {
		const rows = await this.db.categories.toArray();
		return rows
			.filter((c) => includeArchived || c.archivedAt === null)
			.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
	}

	async putCategory(category: Category): Promise<void> {
		await this.db.categories.put({ ...category });
	}

	async deleteCategory(id: string): Promise<void> {
		await this.db.categories.delete(id);
	}

	// Rules
	async listRules(): Promise<Rule[]> {
		const rows = await this.db.rules.toArray();
		return rows.sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
	}

	async putRule(rule: Rule): Promise<void> {
		await this.db.rules.put({ ...rule });
	}

	async deleteRule(id: string): Promise<void> {
		await this.db.rules.delete(id);
	}

	// Payee memory
	async listPayeeMemory(): Promise<PayeeMemoryEntry[]> {
		return this.db.payeeMemory.toArray();
	}

	async putPayeeMemory(entry: PayeeMemoryEntry): Promise<void> {
		await this.db.payeeMemory.put({ ...entry });
	}

	async deletePayeeMemory(key: string): Promise<void> {
		await this.db.payeeMemory.delete(key);
	}

	// Budgets
	async listBudgets(month?: string): Promise<Budget[]> {
		const rows = await this.db.budgets.toArray();
		return rows.filter((b) => !month || b.month === month);
	}

	async putBudget(budget: Budget): Promise<void> {
		await this.db.budgets.put({ ...budget });
	}

	async deleteBudget(id: string): Promise<void> {
		await this.db.budgets.delete(id);
	}

	// Bills
	async listBills(includeArchived = false): Promise<Bill[]> {
		const rows = await this.db.bills.toArray();
		return rows.filter((b) => includeArchived || b.archivedAt === null);
	}

	async putBill(bill: Bill): Promise<void> {
		await this.db.bills.put({ ...bill });
	}

	async deleteBill(id: string): Promise<void> {
		await this.db.bills.delete(id);
	}

	// Import batches
	async listImportBatches(): Promise<ImportBatch[]> {
		const rows = await this.db.importBatches.toArray();
		return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	async putImportBatch(batch: ImportBatch): Promise<void> {
		await this.db.importBatches.put({ ...batch });
	}

	async deleteImportBatch(id: string): Promise<void> {
		await this.db.importBatches.delete(id);
	}

	// Settings
	async getSetting<T>(key: string): Promise<T | undefined> {
		const row = await this.db.settings.get(key);
		return row?.value as T | undefined;
	}

	async putSetting(key: string, value: unknown): Promise<void> {
		await this.db.settings.put({ key, value });
	}

	async listSettings(): Promise<Array<{ key: string; value: unknown }>> {
		const rows = await this.db.settings.toArray();
		return rows.map((row) => ({ key: row.key, value: row.value }));
	}

	async deleteSetting(key: string): Promise<void> {
		await this.db.settings.delete(key);
	}

	async clear(): Promise<void> {
		await this.db.transaction('rw', this.db.tables, async () => {
			for (const table of this.db.tables) await table.clear();
		});
	}
}

/**
 * Create an IndexedDB-backed repository. Throws synchronously when IndexedDB
 * is missing so the app bootstrap can fall back to `MemoryRepository`
 * (src/lib/app/ledger.ts); the connection itself opens lazily on first use.
 */
export function createIndexedDbRepository(dbName = 'ledgerly'): LedgerRepository {
	if (typeof indexedDB === 'undefined') {
		throw new Error('IndexedDB is not available in this environment');
	}
	return new IndexedDbRepository(dbName);
}

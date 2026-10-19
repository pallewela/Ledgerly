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
} from '../engine/types';
import { nowIso } from '../engine/util';

/**
 * Full-fidelity, versioned dump of every repository table.
 *
 * Version 1 is the only supported shape; a future schema change must bump it
 * so restore can refuse rather than silently drop data (PRD FR-8.6).
 */
export interface LedgerSnapshot {
	version: 1;
	/** ISO timestamp of the export. */
	exportedAt: string;
	accounts: Account[];
	balanceSnapshots: BalanceSnapshot[];
	transactions: Transaction[];
	splits: Split[];
	categories: Category[];
	rules: Rule[];
	payeeMemory: PayeeMemoryEntry[];
	budgets: Budget[];
	bills: Bill[];
	importBatches: ImportBatch[];
	settings: Array<{ key: string; value: unknown }>;
}

type SnapshotArrayField = Exclude<keyof LedgerSnapshot, 'version' | 'exportedAt'>;

const SNAPSHOT_ARRAY_FIELDS: readonly SnapshotArrayField[] = [
	'accounts',
	'balanceSnapshots',
	'transactions',
	'splits',
	'categories',
	'rules',
	'payeeMemory',
	'budgets',
	'bills',
	'importBatches',
	'settings',
];

/** Throws a descriptive Error when the payload is not a v1 snapshot. */
function assertValidSnapshot(snapshot: LedgerSnapshot): void {
	if (snapshot === null || typeof snapshot !== 'object') {
		throw new Error('Invalid ledger snapshot: expected an object');
	}
	const version = (snapshot as { version?: unknown }).version;
	if (version !== 1) {
		throw new Error(`Unsupported ledger snapshot version: ${String(version)} (expected 1)`);
	}
	for (const field of SNAPSHOT_ARRAY_FIELDS) {
		if (!Array.isArray(snapshot[field])) {
			throw new Error(`Invalid ledger snapshot: "${field}" must be an array`);
		}
	}
}

/** Read every table into a single serialisable snapshot. */
export async function exportSnapshot(repo: LedgerRepository): Promise<LedgerSnapshot> {
	const [
		accounts,
		balanceSnapshots,
		transactions,
		splits,
		categories,
		rules,
		payeeMemory,
		budgets,
		bills,
		importBatches,
		settings,
	] = await Promise.all([
		repo.listAccounts(true),
		repo.listBalanceSnapshots(),
		// No filter: the snapshot must contain every row, archived or not.
		repo.listTransactions(),
		repo.listAllSplits(),
		repo.listCategories(true),
		repo.listRules(),
		repo.listPayeeMemory(),
		repo.listBudgets(),
		repo.listBills(true),
		repo.listImportBatches(),
		repo.listSettings(),
	]);

	return {
		version: 1,
		exportedAt: nowIso(),
		accounts,
		balanceSnapshots,
		transactions,
		splits,
		categories,
		rules,
		payeeMemory,
		budgets,
		bills,
		importBatches,
		settings,
	};
}

/**
 * Write a snapshot back into a repository.
 *
 * - `replace` (default) hard-clears every table first, restoring the exact
 *   snapshot contents.
 * - `merge` upserts without deleting anything; rows already present but
 *   absent from the snapshot are kept.
 *
 * The snapshot is validated before anything is written, so a malformed
 * payload is rejected before `replace` clears the existing database.
 */
export async function restoreSnapshot(
	repo: LedgerRepository,
	snapshot: LedgerSnapshot,
	mode: 'replace' | 'merge' = 'replace',
): Promise<void> {
	assertValidSnapshot(snapshot);
	if (mode !== 'replace' && mode !== 'merge') {
		throw new Error(`Invalid restore mode: ${String(mode)} (expected "replace" or "merge")`);
	}
	if (mode === 'replace') await repo.clear();

	for (const account of snapshot.accounts) await repo.putAccount(account);
	for (const balanceSnapshot of snapshot.balanceSnapshots) {
		await repo.putBalanceSnapshot(balanceSnapshot);
	}
	for (const category of snapshot.categories) await repo.putCategory(category);
	for (const rule of snapshot.rules) await repo.putRule(rule);
	for (const entry of snapshot.payeeMemory) await repo.putPayeeMemory(entry);
	for (const budget of snapshot.budgets) await repo.putBudget(budget);
	for (const bill of snapshot.bills) await repo.putBill(bill);
	for (const batch of snapshot.importBatches) await repo.putImportBatch(batch);
	for (const transaction of snapshot.transactions) await repo.putTransaction(transaction);
	for (const split of snapshot.splits) await repo.putSplit(split);
	for (const setting of snapshot.settings) await repo.putSetting(setting.key, setting.value);
}

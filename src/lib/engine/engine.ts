import type {
	Account,
	BalanceSnapshot,
	Bill,
	Budget,
	Category,
	CurrencyCode,
	FxRateTable,
	ImportBatch,
	Rule,
	Split,
	Transaction,
	TxFilter,
} from './types';
import type {
	AccountInput,
	BudgetPace,
	EngineApi,
	EngineFactory,
	NetWorthReport,
	NewSplit,
	TransactionInput,
	TransferPair,
} from './api';
import type { LedgerRepository } from './repository';
import { convertMoney } from './currency';
import {
	addMonths,
	clamp,
	daysInMonth,
	isoDateString,
	monthKeyOf,
	newId,
	normalizePayeeKey,
} from './util';

/**
 * The engine — Stage 2 implementation of the frozen EngineApi (api.ts).
 *
 * Invariants enforced here (PLAN §5 W2/W3):
 *   - amounts are integers in the account's currency; every write validates.
 *   - balances anchor on the latest BalanceSnapshot on/before the date;
 *     transactions dated ON the snapshot date are considered included.
 *   - transfer legs always come in pairs sharing one transferId, opposite
 *     signs, same currency (cross-currency transfers are Q-B22, V1.1).
 *   - splits must sum exactly to the parent amount and share its sign.
 *   - reports never guess FX: missing rates surface via missingRates.
 */

const DAY_MS = 86_400_000;

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function assertMinor(amount: number, label: string): void {
	assert(Number.isInteger(amount), `${label} must be an integer number of minor units`);
	assert(Math.abs(amount) <= Number.MAX_SAFE_INTEGER, `${label} is too large`);
}

function assertIsoDate(date: string): void {
	assert(/^\d{4}-\d{2}-\d{2}$/.test(date), `invalid date "${date}" — expected YYYY-MM-DD`);
}

function assertMonth(month: string): void {
	assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), `invalid month "${month}" — expected YYYY-MM`);
}

function monthRange(month: string): { from: string; to: string } {
	return { from: `${month}-01`, to: `${month}-${daysInMonth(month)}` };
}

function dayDiff(a: string, b: string): number {
	return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS;
}

export function createEngine(
	repo: LedgerRepository,
	clock: () => Date = () => new Date(),
): EngineApi {
	const now = () => clock().toISOString();
	const today = () => isoDateString(clock());

	/** Effective category/amount components of a transaction (split-aware). */
	async function componentsOf(
		tx: Transaction,
	): Promise<Array<{ categoryId: string | null; amountMinor: number }>> {
		const splits = await repo.listSplitsForTransaction(tx.id);
		if (splits.length === 0) return [{ categoryId: tx.categoryId, amountMinor: tx.amountMinor }];
		return splits.map((s) => ({ categoryId: s.categoryId, amountMinor: s.amountMinor }));
	}

	async function requireAccount(id: string): Promise<Account> {
		const account = await repo.getAccount(id);
		assert(account, `account ${id} not found`);
		return account;
	}

	async function requireCategory(id: string): Promise<Category> {
		const categories = await repo.listCategories(true);
		const category = categories.find((c) => c.id === id);
		assert(category, `category ${id} not found`);
		return category;
	}

	async function balanceAt(accountId: string, asOf: string): Promise<number> {
		const account = await requireAccount(accountId);
		const snapshots = (await repo.listBalanceSnapshots(accountId))
			.filter((s) => s.date <= asOf)
			.sort((a, b) => a.date.localeCompare(b.date));
		const anchor = snapshots.at(-1);
		const anchorDate = anchor?.date ?? '';
		const anchorBalance = anchor?.balanceMinor ?? account.openingBalanceMinor;
		const txs = await repo.listTransactions({ accountIds: [accountId], to: asOf });
		const delta = txs.filter((t) => t.date > anchorDate).reduce((sum, t) => sum + t.amountMinor, 0);
		return anchorBalance + delta;
	}

	/** Convert minor units between currencies using an explicit dated table. */
	async function convertAmount(
		amountMinor: number,
		from: CurrencyCode,
		table: FxRateTable,
		missing: Set<CurrencyCode>,
	): Promise<number | null> {
		if (from === table.base) return amountMinor;
		const converted = convertMoney({ minorUnits: amountMinor, currency: from }, table);
		if (converted === undefined) {
			missing.add(from);
			return null;
		}
		return converted.minorUnits;
	}

	async function listTransactions(filter?: TxFilter): Promise<Transaction[]> {
		return repo.listTransactions(filter);
	}

	const engine: EngineApi = {
		// ---------------------------------------------------------------- accounts
		async createAccount(input: AccountInput) {
			assert(input.name.trim().length > 0, 'account name is required');
			assert(/^[A-Z]{3}$/.test(input.currency), 'currency must be a 3-letter ISO code');
			assertMinor(input.openingBalanceMinor, 'opening balance');
			const stamp = now();
			const account: Account = {
				id: newId(),
				name: input.name.trim(),
				type: input.type,
				currency: input.currency,
				institution: input.institution?.trim() || null,
				openingBalanceMinor: input.openingBalanceMinor,
				includeInNetWorth: input.includeInNetWorth ?? true,
				archivedAt: null,
				createdAt: stamp,
				updatedAt: stamp,
			};
			await repo.putAccount(account);
			return account;
		},

		async updateAccount(id, patch) {
			const account = await requireAccount(id);
			const next: Account = { ...account, ...patch, id, updatedAt: now() };
			if (patch.currency !== undefined) {
				assert(/^[A-Z]{3}$/.test(patch.currency), 'currency must be a 3-letter ISO code');
				const txs = await repo.listTransactions({ accountIds: [id] });
				assert(txs.length === 0, 'cannot change currency once transactions exist');
			}
			if (patch.openingBalanceMinor !== undefined) {
				assertMinor(patch.openingBalanceMinor, 'opening balance');
			}
			await repo.putAccount(next);
			return next;
		},

		async archiveAccount(id, archived) {
			const account = await requireAccount(id);
			await repo.putAccount({ ...account, archivedAt: archived ? now() : null, updatedAt: now() });
		},

		async listAccounts(opts) {
			return repo.listAccounts(opts?.includeArchived ?? false);
		},

		async computeBalance(accountId, asOf) {
			return balanceAt(accountId, asOf ?? today());
		},

		async recordBalanceSnapshot(accountId, date, balanceMinor, note) {
			await requireAccount(accountId);
			assertIsoDate(date);
			assertMinor(balanceMinor, 'balance');
			const snapshot: BalanceSnapshot = {
				id: newId(),
				accountId,
				date,
				balanceMinor,
				note: note ?? null,
				createdAt: now(),
			};
			await repo.putBalanceSnapshot(snapshot);
			return snapshot;
		},

		async listBalanceSnapshots(accountId) {
			return repo.listBalanceSnapshots(accountId);
		},

		// ------------------------------------------------------------ transactions
		async addTransaction(input: TransactionInput) {
			const account = await requireAccount(input.accountId);
			assert(!account.archivedAt, 'cannot add transactions to an archived account');
			assertIsoDate(input.date);
			assertMinor(input.amountMinor, 'amount');
			assert(input.amountMinor !== 0, 'amount cannot be zero');
			assert(input.payee.trim().length > 0, 'payee is required');
			if (input.categoryId) await requireCategory(input.categoryId);

			const transferId = input.transferToAccountId ? newId() : null;
			if (input.transferToAccountId) {
				const peer = await requireAccount(input.transferToAccountId);
				assert(peer.id !== account.id, 'cannot transfer to the same account');
				assert(!peer.archivedAt, 'cannot transfer to an archived account');
				assert(
					peer.currency === account.currency,
					'cross-currency transfers are not supported yet (Q-B22)',
				);
			}

			const stamp = now();
			const tx: Transaction = {
				id: newId(),
				accountId: account.id,
				date: input.date,
				payee: input.payee.trim(),
				amountMinor: input.amountMinor,
				categoryId: input.categoryId ?? null,
				note: input.note ?? null,
				tags: input.tags ?? [],
				transferId,
				importBatchId: input.importBatchId ?? null,
				source: input.source ?? 'manual',
				createdAt: stamp,
				updatedAt: stamp,
			};

			if (!transferId) {
				await repo.putTransaction(tx);
				return tx;
			}

			const peerTx: Transaction = {
				...tx,
				id: newId(),
				accountId: input.transferToAccountId!,
				amountMinor: -input.amountMinor,
				categoryId: null,
			};
			await repo.putTransaction(tx);
			await repo.putTransaction(peerTx);
			return tx;
		},

		async updateTransaction(id, patch) {
			const tx = await repo.getTransaction(id);
			assert(tx, `transaction ${id} not found`);
			if (patch.amountMinor !== undefined) {
				assertMinor(patch.amountMinor, 'amount');
				assert(patch.amountMinor !== 0, 'amount cannot be zero');
				assert(!tx.transferId, 'cannot change the amount of a transfer leg — unpair first');
			}
			if (tx.transferId && patch.transferId !== undefined) {
				assert(
					patch.transferId === tx.transferId,
					'cannot manually change transferId — use pair/unpair',
				);
			}
			if (patch.categoryId) await requireCategory(patch.categoryId);

			// Assigning a single category collapses an existing split.
			if (patch.categoryId !== undefined && patch.categoryId !== null) {
				await repo.deleteSplitsForTransaction(id);
			}

			const next: Transaction = { ...tx, ...patch, id, updatedAt: now() };
			await repo.putTransaction(next);
			return next;
		},

		async deleteTransaction(id) {
			const tx = await repo.getTransaction(id);
			assert(tx, `transaction ${id} not found`);
			await repo.deleteSplitsForTransaction(id);
			await repo.deleteTransaction(id);
			if (tx.transferId) {
				const legs = (await repo.listTransactions()).filter(
					(t) => t.transferId === tx.transferId && t.id !== id,
				);
				for (const leg of legs) {
					await repo.deleteSplitsForTransaction(leg.id);
					await repo.deleteTransaction(leg.id);
				}
			}
		},

		async getTransaction(id) {
			return repo.getTransaction(id);
		},

		listTransactions,

		async splitTransaction(id, parts: NewSplit[]) {
			const tx = await repo.getTransaction(id);
			assert(tx, `transaction ${id} not found`);
			assert(parts.length >= 2, 'a split needs at least two parts');
			for (const part of parts) {
				assertMinor(part.amountMinor, 'split amount');
				assert(part.amountMinor !== 0, 'split amounts cannot be zero');
				assert(
					Math.sign(part.amountMinor) === Math.sign(tx.amountMinor),
					'split parts must share the parent transaction sign',
				);
				await requireCategory(part.categoryId);
			}
			const total = parts.reduce((sum, p) => sum + p.amountMinor, 0);
			assert(total === tx.amountMinor, `split parts must sum to ${tx.amountMinor}, got ${total}`);

			await repo.deleteSplitsForTransaction(id);
			for (const part of parts) {
				const split: Split = {
					id: newId(),
					transactionId: id,
					categoryId: part.categoryId,
					amountMinor: part.amountMinor,
					note: part.note ?? null,
				};
				await repo.putSplit(split);
			}
			await repo.putTransaction({ ...tx, categoryId: null, updatedAt: now() });
			return (await repo.getTransaction(id))!;
		},

		async listSplitsForTransaction(transactionId) {
			return repo.listSplitsForTransaction(transactionId);
		},

		// ----------------------------------------------------------------- transfers
		async suggestTransferPairs(opts) {
			const windowDays = opts?.windowDays ?? 5;
			const accounts = await repo.listAccounts(true);
			const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
			const candidates = (await repo.listTransactions()).filter((t) => t.transferId === null);
			const used = new Set<string>();
			const pairs: TransferPair[] = [];

			const negatives = candidates
				.filter((t) => t.amountMinor < 0)
				.sort((a, b) => a.date.localeCompare(b.date));

			for (const a of negatives) {
				if (used.has(a.id)) continue;
				let best: Transaction | null = null;
				let bestDiff = Infinity;
				for (const b of candidates) {
					if (b.id === a.id || used.has(b.id) || b.amountMinor <= 0) continue;
					if (b.accountId === a.accountId) continue;
					if (currencyOf.get(a.accountId) !== currencyOf.get(b.accountId)) continue;
					if (b.amountMinor !== -a.amountMinor) continue;
					const diff = dayDiff(a.date, b.date);
					if (diff > windowDays || diff >= bestDiff) continue;
					best = b;
					bestDiff = diff;
				}
				if (best) {
					used.add(a.id);
					used.add(best.id);
					pairs.push({ a, b: best });
					if (pairs.length >= 50) break;
				}
			}
			return pairs;
		},

		async pairAsTransfer(aId, bId) {
			const a = await repo.getTransaction(aId);
			const b = await repo.getTransaction(bId);
			assert(a && b, 'both transactions must exist');
			assert(a.id !== b.id, 'cannot pair a transaction with itself');
			assert(!a.transferId && !b.transferId, 'transactions are already part of a transfer');
			assert(a.accountId !== b.accountId, 'transfer legs must sit on different accounts');
			const aAcc = await requireAccount(a.accountId);
			const bAcc = await requireAccount(b.accountId);
			assert(aAcc.currency === bAcc.currency, 'cross-currency transfers are not supported yet');
			assert(a.amountMinor === -b.amountMinor, 'transfer legs must have equal, opposite amounts');
			const transferId = newId();
			const stamp = now();
			await repo.putTransaction({ ...a, transferId, categoryId: null, updatedAt: stamp });
			await repo.putTransaction({ ...b, transferId, categoryId: null, updatedAt: stamp });
			return transferId;
		},

		async unpairTransfer(transferId) {
			const legs = (await repo.listTransactions()).filter((t) => t.transferId === transferId);
			assert(legs.length > 0, `transfer ${transferId} not found`);
			for (const leg of legs) {
				await repo.putTransaction({ ...leg, transferId: null, updatedAt: now() });
			}
		},

		// ----------------------------------------------------------------- categories
		async createCategory(input) {
			assert(input.name.trim().length > 0, 'category name is required');
			if (input.parentId) {
				const parent = await requireCategory(input.parentId);
				assert(parent.parentId === null, 'categories support at most two levels');
			}
			const categories = await repo.listCategories(true);
			const siblings = categories.filter((c) => c.parentId === (input.parentId ?? null));
			const category: Category = {
				id: newId(),
				name: input.name.trim(),
				parentId: input.parentId ?? null,
				kind: input.kind,
				archivedAt: null,
				sortOrder: input.sortOrder ?? siblings.length,
			};
			await repo.putCategory(category);
			return category;
		},

		async updateCategory(id, patch) {
			const category = await requireCategory(id);
			if (patch.parentId !== undefined && patch.parentId !== null) {
				assert(patch.parentId !== id, 'a category cannot be its own parent');
				const parent = await requireCategory(patch.parentId);
				assert(parent.parentId === null, 'categories support at most two levels');
			}
			const next: Category = { ...category, ...patch, id };
			await repo.putCategory(next);
			return next;
		},

		async archiveCategory(id, archived) {
			const category = await requireCategory(id);
			await repo.putCategory({ ...category, archivedAt: archived ? now() : null });
		},

		async listCategories(opts) {
			return repo.listCategories(opts?.includeArchived ?? false);
		},

		// ---------------------------------------------------------------------- rules
		async createRule(match, action, priority) {
			assert(match.payeeContains.trim().length > 0, 'rule needs a payee substring');
			await requireCategory(action.categoryId);
			const rules = await repo.listRules();
			const rule: Rule = {
				id: newId(),
				priority: priority ?? (rules.at(-1)?.priority ?? -1) + 1,
				match: { ...match, payeeContains: match.payeeContains.trim() },
				action: { ...action },
				enabled: true,
				createdAt: now(),
			};
			await repo.putRule(rule);
			return rule;
		},

		async updateRule(id, patch) {
			const rules = await repo.listRules();
			const rule = rules.find((r) => r.id === id);
			assert(rule, `rule ${id} not found`);
			if (patch.action?.categoryId) await requireCategory(patch.action.categoryId);
			const next: Rule = { ...rule, ...patch, id, createdAt: rule.createdAt };
			await repo.putRule(next);
			return next;
		},

		async deleteRule(id) {
			await repo.deleteRule(id);
		},

		async listRules() {
			return repo.listRules();
		},

		async applyRulesToTransaction(tx) {
			const rules = await repo.listRules();
			const match = rules.find((rule) => ruleMatches(rule, tx));
			if (!match) return tx;
			return applyRule(repo, tx, match, now());
		},

		async previewRules(days) {
			const from = isoDateString(new Date(Date.parse(`${today()}T00:00:00Z`) - days * DAY_MS));
			const txs = await repo.listTransactions({ from });
			const rules = await repo.listRules();
			return txs.map((tx) => ({ tx, matchedRule: rules.find((r) => ruleMatches(r, tx)) ?? null }));
		},

		// --------------------------------------------------------------- payee memory
		async rememberPayeeChoice(payee, accountId, categoryId) {
			await requireCategory(categoryId);
			const key = `${normalizePayeeKey(payee)}|${accountId}`;
			const existing = (await repo.listPayeeMemory()).find((m) => m.key === key);
			await repo.putPayeeMemory({
				key,
				payee: payee.trim(),
				accountId,
				categoryId,
				useCount: (existing?.useCount ?? 0) + 1,
				lastUsedAt: now(),
			});
		},

		async suggestCategory(payee, accountId) {
			// Rules with amount constraints need the transaction amount; this
			// advisory API has none, so only unconditional rules participate.
			const rules = (await repo.listRules()).filter(
				(r) =>
					r.enabled &&
					r.match.amountMinMinor === undefined &&
					r.match.amountMaxMinor === undefined &&
					(r.match.accountId === undefined || r.match.accountId === accountId) &&
					payee.toLowerCase().includes(r.match.payeeContains.toLowerCase()),
			);
			if (rules.length > 0) {
				const rule = rules[0];
				return {
					categoryId: rule.action.categoryId,
					source: 'rule',
					reason: `Rule: payee contains "${rule.match.payeeContains}"`,
				};
			}
			const key = `${normalizePayeeKey(payee)}|${accountId}`;
			const entries = (await repo.listPayeeMemory()).filter((m) => m.accountId === accountId);
			const exact = entries.find((m) => m.key === key);
			let memory = exact;
			if (!memory) {
				// Fuzzy match so a correction on "BLUE BOTTLE" also covers
				// "BLUE BOTTLE #412": prefer the longest containment (≥3 chars),
				// then the most recently used entry.
				const norm = normalizePayeeKey(payee);
				const candidates = entries
					.filter((m) => {
						const stored = m.key.slice(0, m.key.lastIndexOf('|'));
						return stored.length >= 3 && (norm.includes(stored) || stored.includes(norm));
					})
					.sort((a, b) => b.key.length - a.key.length || b.lastUsedAt.localeCompare(a.lastUsedAt));
				memory = candidates[0];
			}
			if (memory) {
				const categories = await repo.listCategories(true);
				const category = categories.find((c) => c.id === memory.categoryId);
				return {
					categoryId: memory.categoryId,
					source: 'payee-memory',
					reason: `You categorized "${memory.payee}" as ${category?.name ?? 'this category'} before`,
				};
			}
			return { categoryId: null, source: 'none', reason: 'No rule or past choice matches yet' };
		},

		// -------------------------------------------------------------------- budgets
		async setBudget(month, categoryId, limitMinor, rollover = false) {
			assertMonth(month);
			assertMinor(limitMinor, 'budget limit');
			assert(limitMinor >= 0, 'budget limit cannot be negative');
			await requireCategory(categoryId);
			const existing = (await repo.listBudgets(month)).find((b) => b.categoryId === categoryId);
			const budget: Budget = {
				id: existing?.id ?? newId(),
				month,
				categoryId,
				limitMinor,
				rollover,
			};
			await repo.putBudget(budget);
			return budget;
		},

		async deleteBudget(id) {
			await repo.deleteBudget(id);
		},

		async listBudgets(month) {
			return repo.listBudgets(month);
		},

		async budgetStatus(month, fx) {
			assertMonth(month);
			const budgets = await repo.listBudgets(month);
			const { from, to } = monthRange(month);
			const txs = (await repo.listTransactions({ from, to })).filter((t) => t.transferId === null);
			const accounts = await repo.listAccounts(true);
			const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
			const missing = new Set<CurrencyCode>();
			const spentByCategory = new Map<string, number>();

			for (const tx of txs) {
				const components = await componentsOf(tx);
				const currency = currencyOf.get(tx.accountId) ?? 'USD';
				for (const component of components) {
					if (!component.categoryId) continue;
					const converted = await convertAmount(-component.amountMinor, currency, fx, missing);
					if (converted === null) continue;
					spentByCategory.set(
						component.categoryId,
						(spentByCategory.get(component.categoryId) ?? 0) + converted,
					);
				}
			}

			const nowDate = clock();
			const dayOfMonth = clamp(nowDate.getDate(), 1, daysInMonth(month));
			const totalDays = daysInMonth(month);

			const byCategory = budgets.map((budget) => {
				const spent = spentByCategory.get(budget.categoryId) ?? 0;
				const remaining = budget.limitMinor - spent;
				const projected =
					budget.limitMinor === 0 ? spent : Math.round((spent / dayOfMonth) * totalDays);
				let pace: BudgetPace;
				if (spent > budget.limitMinor) pace = 'over';
				else if (projected > budget.limitMinor) pace = 'projected-over';
				else if (projected >= budget.limitMinor * 0.85) pace = 'on-pace';
				else pace = 'under';
				return {
					categoryId: budget.categoryId,
					limitMinor: budget.limitMinor,
					spentInBaseMinor: spent,
					remainingMinor: remaining,
					pace,
				};
			});

			return { month, base: fx.base, byCategory, missingRates: [...missing] };
		},

		// ---------------------------------------------------------------------- bills
		async createBill(input) {
			assert(input.name.trim().length > 0, 'bill name is required');
			assert(
				Number.isInteger(input.dueDay) && input.dueDay >= 1 && input.dueDay <= 31,
				'dueDay 1–31',
			);
			if (input.amountMinor !== null) assertMinor(input.amountMinor, 'bill amount');
			if (input.accountId) await requireAccount(input.accountId);
			const bill: Bill = {
				id: newId(),
				name: input.name.trim(),
				amountMinor: input.amountMinor,
				dueDay: input.dueDay,
				accountId: input.accountId ?? null,
				archivedAt: null,
				lastPaidAt: null,
			};
			await repo.putBill(bill);
			return bill;
		},

		async updateBill(id, patch) {
			const bills = await repo.listBills(true);
			const bill = bills.find((b) => b.id === id);
			assert(bill, `bill ${id} not found`);
			if (patch.amountMinor !== undefined && patch.amountMinor !== null) {
				assertMinor(patch.amountMinor, 'bill amount');
			}
			if (patch.dueDay !== undefined) {
				assert(patch.dueDay >= 1 && patch.dueDay <= 31, 'dueDay 1–31');
			}
			const next: Bill = { ...bill, ...patch, id };
			await repo.putBill(next);
			return next;
		},

		async deleteBill(id) {
			await repo.deleteBill(id);
		},

		async listBills(opts) {
			return repo.listBills(opts?.includeArchived ?? false);
		},

		async upcomingBills(days, from) {
			const start = from ?? today();
			return computeUpcomingBills(await repo.listBills(false), days, start);
		},

		async markBillPaid(billId, txInput) {
			const bills = await repo.listBills(true);
			const bill = bills.find((b) => b.id === billId);
			assert(bill, `bill ${billId} not found`);
			const tx = await engine.addTransaction({
				...txInput,
				accountId: txInput.accountId ?? bill.accountId ?? '',
			});
			await repo.putBill({ ...bill, lastPaidAt: tx.date });
			return tx;
		},

		// -------------------------------------------------------------------- reports
		async netWorth(asOf, base, fx) {
			const accounts = (await repo.listAccounts(false)).filter((a) => a.includeInNetWorth);
			const missing = new Set<CurrencyCode>();
			const rows: NetWorthReport['accounts'] = [];
			const perCurrency = new Map<CurrencyCode, number>();
			let total = 0;

			for (const account of accounts) {
				const balanceMinor = await balanceAt(account.id, asOf);
				perCurrency.set(account.currency, (perCurrency.get(account.currency) ?? 0) + balanceMinor);
				const converted = await convertAmount(balanceMinor, account.currency, fx, missing);
				if (converted !== null) total += converted;
				rows.push({
					account,
					balanceMinor,
					balanceInBaseMinor: converted,
				});
			}

			return {
				asOf,
				base,
				fx,
				accounts: rows,
				perCurrency: [...perCurrency.entries()].map(([currency, totalMinor]) => ({
					currency,
					totalMinor,
				})),
				totalInBaseMinor: total,
				missingRates: [...missing],
			};
		},

		async monthSummary(month, base, fx) {
			assertMonth(month);
			const { from, to } = monthRange(month);
			const txs = (await repo.listTransactions({ from, to })).filter((t) => t.transferId === null);
			const accounts = await repo.listAccounts(true);
			const categories = await repo.listCategories(true);
			const categoryKind = new Map(categories.map((c) => [c.id, c.kind]));
			const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
			const missing = new Set<CurrencyCode>();
			const byCategory = new Map<string | null, number>();
			let income = 0;
			let expense = 0;

			for (const tx of txs) {
				const currency = currencyOf.get(tx.accountId) ?? 'USD';
				const components = await componentsOf(tx);
				for (const component of components) {
					const converted = await convertAmount(component.amountMinor, currency, fx, missing);
					if (converted === null) continue;
					byCategory.set(
						component.categoryId,
						(byCategory.get(component.categoryId) ?? 0) + converted,
					);
					const kind = component.categoryId ? categoryKind.get(component.categoryId) : undefined;
					if (kind === 'income' || (kind === undefined && converted > 0)) income += converted;
					else if (kind === 'expense' || (kind === undefined && converted < 0)) {
						expense += -converted;
					} else if (kind === 'savings') {
						// Savings moves are cash outflow for cash-flow purposes.
						if (converted < 0) expense += -converted;
					}
				}
			}

			return {
				month,
				base,
				fx,
				incomeInBaseMinor: income,
				expenseInBaseMinor: expense,
				netInBaseMinor: income - expense,
				byCategory: [...byCategory.entries()].map(([categoryId, totalInBaseMinor]) => ({
					categoryId,
					kind: categoryId ? (categoryKind.get(categoryId) ?? null) : null,
					totalInBaseMinor,
				})),
				missingRates: [...missing],
			};
		},

		// -------------------------------------------------------------- import support
		async recordImportBatch(batch) {
			const existing = (await repo.listImportBatches()).find((b) => b.id === batch.id);
			const record: ImportBatch = {
				...batch,
				createdAt: batch.createdAt ?? existing?.createdAt ?? now(),
			};
			await repo.putImportBatch(record);
			return record;
		},

		async undoImportBatch(batchId) {
			const txs = (await repo.listTransactions()).filter((t) => t.importBatchId === batchId);
			for (const tx of txs) await engine.deleteTransaction(tx.id);
			await repo.deleteImportBatch(batchId);
			return txs.length;
		},

		async listImportBatches() {
			return repo.listImportBatches();
		},
	};

	return engine;
}

function ruleMatches(rule: Rule, tx: Transaction): boolean {
	if (!rule.enabled) return false;
	if (!tx.payee.toLowerCase().includes(rule.match.payeeContains.toLowerCase())) return false;
	const magnitude = Math.abs(tx.amountMinor);
	if (rule.match.amountMinMinor !== undefined && magnitude < rule.match.amountMinMinor)
		return false;
	if (rule.match.amountMaxMinor !== undefined && magnitude > rule.match.amountMaxMinor)
		return false;
	if (rule.match.accountId !== undefined && tx.accountId !== rule.match.accountId) return false;
	return true;
}

async function applyRule(
	repo: LedgerRepository,
	tx: Transaction,
	rule: Rule,
	stamp: string,
): Promise<Transaction> {
	const next: Transaction = {
		...tx,
		categoryId: rule.action.categoryId,
		payee: rule.action.renamePayee?.trim() || tx.payee,
		tags: [...new Set([...tx.tags, ...(rule.action.addTags ?? [])])],
		updatedAt: stamp,
	};
	if (next.categoryId !== null) await repo.deleteSplitsForTransaction(tx.id);
	await repo.putTransaction(next);
	return next;
}

export async function seedDefaultCategories(engine: EngineApi): Promise<void> {
	const existing = await engine.listCategories({ includeArchived: true });
	if (existing.length > 0) return;

	const tree: Array<{
		name: string;
		kind: 'income' | 'expense' | 'transfer' | 'savings';
		children?: string[];
	}> = [
		{ name: 'Income', kind: 'income', children: ['Salary', 'Other income'] },
		{
			name: 'Living',
			kind: 'expense',
			children: ['Groceries', 'Eating out', 'Transport', 'Utilities', 'Phone & internet'],
		},
		{ name: 'Home', kind: 'expense', children: ['Rent / mortgage', 'Repairs', 'Furniture'] },
		{
			name: 'Life',
			kind: 'expense',
			children: ['Health', 'Education', 'Kids', 'Personal care', 'Gifts & donations'],
		},
		{
			name: 'Leisure',
			kind: 'expense',
			children: ['Entertainment', 'Subscriptions', 'Travel', 'Shopping'],
		},
		{ name: 'Obligations', kind: 'expense', children: ['Insurance', 'Fees & charges', 'Taxes'] },
		{ name: 'Savings', kind: 'savings', children: ['Emergency fund', 'Investments'] },
	];

	for (const parent of tree) {
		const created = await engine.createCategory({ name: parent.name, kind: parent.kind });
		for (const child of parent.children ?? []) {
			await engine.createCategory({ name: child, kind: parent.kind, parentId: created.id });
		}
	}
}

/** Bill due dates: this month's dueDay if still ahead, else next month's. */
export function computeUpcomingBills(
	bills: Bill[],
	days: number,
	from: string,
): Array<{ bill: Bill; dueDate: string }> {
	const fromDate = Date.parse(`${from}T00:00:00Z`);
	const out: Array<{ bill: Bill; dueDate: string }> = [];
	for (const bill of bills) {
		if (bill.archivedAt) continue;
		const dueThisMonth = `${from.slice(0, 7)}-${String(bill.dueDay).padStart(2, '0')}`;
		let due: string;
		if (Date.parse(`${dueThisMonth}T00:00:00Z`) >= fromDate) {
			const valid = bill.dueDay <= daysInMonth(monthKeyOf(dueThisMonth));
			due = valid
				? dueThisMonth
				: `${monthKeyOf(dueThisMonth)}-${daysInMonth(monthKeyOf(dueThisMonth))}`;
		} else {
			const next = addMonths(monthKeyOf(from), 1);
			const last = daysInMonth(next);
			due = `${next}-${String(Math.min(bill.dueDay, last)).padStart(2, '0')}`;
		}
		const diff = (Date.parse(`${due}T00:00:00Z`) - fromDate) / DAY_MS;
		if (diff >= 0 && diff <= days) out.push({ bill, dueDate: due });
	}
	return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export const createEngineImpl: EngineFactory = (repo, clock) => createEngine(repo, clock);

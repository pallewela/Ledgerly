import type { EngineApi } from '../engine/api';
import { newId, todayIso } from '../engine/util';
import type { ImportPlan } from './types';

export interface CommitImportResult {
	batchId: string;
	imported: number;
	skipped: number;
}

function createBatchId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return newId();
}

/**
 * Commit a reviewed plan through EngineApi. The batch record is written first
 * so each transaction can reference it; counts are upserted at the end. Any
 * failure undoes the batch (rows and record) before the error is rethrown.
 */
export async function commitImport(args: {
	engine: EngineApi;
	plan: ImportPlan;
	skipDuplicates?: boolean;
}): Promise<CommitImportResult> {
	const { engine, plan } = args;
	const batchId = createBatchId();
	const rowsTotal = plan.rows.length;
	const label = `CSV ${todayIso()} · ${plan.accountId}`;

	try {
		await engine.recordImportBatch({
			id: batchId,
			source: 'csv',
			label,
			accountId: plan.accountId,
			rowsTotal,
			rowsImported: 0,
			rowsSkipped: 0,
		});

		let imported = 0;
		for (const row of plan.rows) {
			if (row.issues.length > 0) continue;
			if (args.skipDuplicates && row.duplicateOf !== null) continue;
			await engine.addTransaction({
				accountId: plan.accountId,
				date: row.date,
				payee: row.payee,
				amountMinor: row.amountMinor,
				source: 'import',
				importBatchId: batchId,
			});
			imported += 1;
		}

		const skipped = rowsTotal - imported;
		await engine.recordImportBatch({
			id: batchId,
			source: 'csv',
			label,
			accountId: plan.accountId,
			rowsTotal,
			rowsImported: imported,
			rowsSkipped: skipped,
		});
		return { batchId, imported, skipped };
	} catch (error) {
		await engine.undoImportBatch(batchId).catch(() => {});
		throw error;
	}
}

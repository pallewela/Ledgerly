import type { LedgerRepository } from '$lib/engine/repository';

/**
 * PLACEHOLDER — replaced by the Stage 2 storage build-out (PLAN W1).
 * The factory shape is part of the module contract: the app bootstrap
 * (src/lib/app/ledger.ts) calls createIndexedDbRepository() inside a
 * try/catch and falls back to MemoryRepository when storage is unavailable.
 */
export function createIndexedDbRepository(): LedgerRepository {
	throw new Error('IndexedDbRepository: not implemented yet (Stage 2 storage build-out)');
}

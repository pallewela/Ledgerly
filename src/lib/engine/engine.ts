import type { EngineApi } from './api';
import type { LedgerRepository } from './repository';

/**
 * PLACEHOLDER — replaced wholesale by the Stage 2 engine build-out
 * (PLAN W2/W3). Exists so every module boundary compiles from day one.
 */
export function createEngine(_repo: LedgerRepository): EngineApi {
	throw new Error('createEngine: not implemented yet (Stage 2 engine build-out)');
}

export async function seedDefaultCategories(_engine: EngineApi): Promise<void> {
	throw new Error('seedDefaultCategories: not implemented yet (Stage 2 engine build-out)');
}

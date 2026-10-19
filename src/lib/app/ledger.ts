import { get, writable } from 'svelte/store';
import type { EngineApi } from '$lib/engine/api';
import type { LedgerRepository } from '$lib/engine/repository';
import { MemoryRepository } from '$lib/engine/memory-repository';

/**
 * App bootstrap store (PRD §10 flow 1). The UI always consumes the engine
 * through these stores — never storage directly. Falls back to an in-memory
 * repository when IndexedDB is unavailable (private mode, tests, SSR-less
 * environments, or the storage module not yet wired).
 */

const engineStore = writable<EngineApi | null>(null);
const repoStore = writable<LedgerRepository | null>(null);
const readyStore = writable(false);
let started = false;

export const engine = { subscribe: engineStore.subscribe };
export const repository = { subscribe: repoStore.subscribe };
export const ledgerReady = { subscribe: readyStore.subscribe };

export async function initLedger(): Promise<void> {
	if (started) return;
	started = true;
	const repo = await openRepository();
	const { createEngine } = await import('$lib/engine');
	engineStore.set(createEngine(repo));
	repoStore.set(repo);
	readyStore.set(true);
}

async function openRepository(): Promise<LedgerRepository> {
	try {
		const storage = await import('$lib/storage');
		return storage.createIndexedDbRepository();
	} catch {
		return new MemoryRepository();
	}
}

/** Throw-safe accessor for imperative code paths. */
export function currentEngine(): EngineApi {
	const e = get(engineStore);
	if (!e) throw new Error('Ledger not initialised — await initLedger() first');
	return e;
}

export { IndexedDbRepository, createIndexedDbRepository } from './indexeddb-repository';
export { exportSnapshot, restoreSnapshot } from './snapshot';
export type { LedgerSnapshot } from './snapshot';

/**
 * Storage entry point. The factory shape is part of the module contract: the
 * app bootstrap (src/lib/app/ledger.ts) calls createIndexedDbRepository()
 * inside a try/catch and falls back to MemoryRepository when storage is
 * unavailable (private mode, tests, or no IndexedDB at all).
 */

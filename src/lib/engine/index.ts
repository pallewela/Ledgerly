/**
 * Engine barrel — the ONLY import surface other modules may use.
 * Contracts (types, currency, repository, api) are frozen at Gate G1;
 * engine.ts is the Stage 2 implementation.
 */
export * from './types';
export * from './util';
export * from './currency';
export * from './repository';
export * from './api';
export { MemoryRepository } from './memory-repository';
export { createEngine, seedDefaultCategories } from './engine';

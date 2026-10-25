// Monobank's own categories → the common ones. Its API states no bank category (rows are categorised by MCC), so the
// table is empty; a bank category on a Monobank row would be reported as unknown.
import type { CategoryHint } from '../types.ts';

export const BANK_CATEGORIES: ReadonlyMap<string, CategoryHint | null> = new Map();

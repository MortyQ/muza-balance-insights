// A-Bank's statement states no category of its own: its rows carry an MCC, which the common table maps. Empty, so
// every bank category is unknown — never reached, its rows have none.
import type { CategoryHint } from '../types.ts';

export const BANK_CATEGORIES: ReadonlyMap<string, CategoryHint | null> = new Map();

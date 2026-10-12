import type { SpendingPrefs } from '../types.ts';

/**
 * The menu choices from storage: each field on its own, defaults for anything else (the old `usd` / `eur` fields are
 * the currency entity's now). The one `as` reads a parsed JSON object's fields after the object / array guard.
 */
export function parsePrefs(raw: string | null): SpendingPrefs {
  const d: SpendingPrefs = { split: true, mark: true };
  if (raw === null) return d;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return d;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  const field = (k: keyof SpendingPrefs): boolean => {
    const x = o[k];
    return typeof x === 'boolean' ? x : d[k];
  };
  return { split: field('split'), mark: field('mark') };
}

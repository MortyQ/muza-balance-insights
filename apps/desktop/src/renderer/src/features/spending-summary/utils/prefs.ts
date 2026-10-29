import { SPLITS } from '../constants.ts';
import type { SpendingPrefs, SpendingSplit } from '../types.ts';

/**
 * The menu choices from storage: each field on its own, defaults for anything else (the old `usd` / `eur` fields are
 * the currency entity's now). The former «Who spent how much» switch carries over: on → by people, off → together. The
 * one `as` reads a parsed JSON object's fields after the object / array guard.
 */
export function parsePrefs(raw: string | null): SpendingPrefs {
  const d: SpendingPrefs = { split: 'people', mark: true };
  if (raw === null) return d;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return d;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  const split: SpendingSplit =
    typeof o.split === 'boolean' ? (o.split ? 'people' : 'together') : SPLITS.find((s) => s === o.split) ?? d.split;
  return { split, mark: typeof o.mark === 'boolean' ? o.mark : d.mark };
}

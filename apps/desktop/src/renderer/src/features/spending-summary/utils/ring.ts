import type { SpendingOverview } from '@contract/api.ts';
import type { RowView } from '../types.ts';
import { totalFor } from './totals.ts';

/** The ring: each part with a small gap; nothing → a plain sunken ring. */
export function ringStops(parts: ReadonlyArray<{ value: number; color: string }>): string {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (sum <= 0) return 'conic-gradient(var(--surface-sunken) 0deg 360deg)';
  const gap = parts.length > 1 ? 1.4 : 0;
  let deg = 0;
  const stops: string[] = [];
  for (const p of parts) {
    const d = (p.value / sum) * 360;
    stops.push(`${p.color} ${deg.toFixed(2)}deg ${(deg + d - gap).toFixed(2)}deg`);
    if (gap) stops.push(`var(--surface) ${(deg + d - gap).toFixed(2)}deg ${(deg + d).toFixed(2)}deg`);
    deg += d;
  }
  return `conic-gradient(${stops.join(', ')})`;
}

/**
 * The ring of the rows: each named row its own net; «Other» gets the rest of the total, so a refund-only category
 * (counted in the total, absent from the rows) never makes the ring larger than the total.
 */
export function ringOf(rows: ReadonlyArray<RowView>, view: Readonly<SpendingOverview>, pick: number | null): string {
  const netOf = (key: string) => {
    const c = view.categories.find((x) => x.category === key);
    if (!c) return 0;
    return pick === null ? c.net : (c.people.find((p) => p.participantId === pick)?.net ?? 0);
  };
  const named = rows.filter((r) => r.key !== 'rest').map((r) => ({ value: netOf(r.key), color: r.color }));
  const rest = rows.find((r) => r.key === 'rest');
  const parts = rest ? [...named, { value: Math.max(0, totalFor(view, pick).net - named.reduce((s, p) => s + p.value, 0)), color: rest.color }] : named;
  return ringStops(parts);
}

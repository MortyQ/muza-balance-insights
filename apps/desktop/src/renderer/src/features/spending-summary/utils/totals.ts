import type { SpendingAmounts, SpendingOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { t } from '@/shared/lib';

/** Whole percent of `whole` (0 when there is no whole). */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function shareOf(part: number, whole: number): string {
  return `${percentOf(part, whole)}%`;
}

/** `home.spending.familyShare` — a person's share of the family's spending. */
export function familyShareText(net: number, familyTotal: number): string {
  return t('home.spending.familyShare', { pct: percentOf(net, familyTotal) });
}

/** Under the ring: the amount in each picked «also» currency (no change chip: one rate for both months). */
export function centerConv(now: number, fmt: MoneyFormat): string[] {
  return fmt.approx(now);
}

/** The family or the picked person. */
export function totalFor(view: Readonly<SpendingOverview>, pick: number | null): SpendingAmounts & { prev: SpendingAmounts | null } {
  if (pick === null) return { net: view.total.net, purchases: view.total.purchases, prev: view.total.prev };
  const p = view.people.find((x) => x.participantId === pick);
  return p ? { net: p.net, purchases: p.purchases, prev: p.prev } : { net: 0, purchases: 0, prev: view.total.prev ? { net: 0, purchases: 0 } : null };
}

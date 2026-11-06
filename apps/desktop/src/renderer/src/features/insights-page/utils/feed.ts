import type { InsightSeverity } from '@contract/api.ts';
import type { FeedFilter, FeedItemView, FeedKind } from '../types.ts';

// The feed's filters (spec desktop-insights-page «Feed filters», «Remembered filter»): pure helpers, no storage here.

export const SEVERITY_FILTERS: ReadonlyArray<FeedFilter['severity']> = ['all', 'high', 'medium', 'low'];
export const KIND_FILTERS: ReadonlyArray<FeedFilter['kind']> = ['all', 'up', 'down', 'income', 'limits', 'payees', 'oneOffs'];
export const NO_FILTER: Readonly<FeedFilter> = { severity: 'all', kind: 'all' };

/** A stored filter read back; anything unknown reads as «All». */
export function parseFeedFilter(raw: string | null): FeedFilter {
  let v: unknown = null;
  try {
    v = raw === null ? null : JSON.parse(raw);
  } catch {
    v = null;
  }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const severity = SEVERITY_FILTERS.find((s) => s === o.severity) ?? 'all';
  const kind = KIND_FILTERS.find((k) => k === o.kind) ?? 'all';
  return { severity, kind };
}

/** The items matching both rows. */
export function filterFeed(items: ReadonlyArray<FeedItemView>, f: Readonly<FeedFilter>): FeedItemView[] {
  return items.filter((i) => (f.severity === 'all' || i.severity === f.severity) && (f.kind === 'all' || i.kind === f.kind));
}

/** The month's count per severity (whatever the kind row says, so the numbers stay put while filtering). */
export function severityCounts(items: ReadonlyArray<FeedItemView>): Record<FeedFilter['severity'], number> {
  const by = (s: InsightSeverity) => items.filter((i) => i.severity === s).length;
  return { all: items.length, high: by('high'), medium: by('medium'), low: by('low') };
}

/** The month's count per kind. */
export function kindCounts(items: ReadonlyArray<FeedItemView>): Record<FeedFilter['kind'], number> {
  const by = (k: FeedKind) => items.filter((i) => i.kind === k).length;
  return { all: items.length, up: by('up'), down: by('down'), income: by('income'), limits: by('limits'), payees: by('payees'), oneOffs: by('oneOffs') };
}

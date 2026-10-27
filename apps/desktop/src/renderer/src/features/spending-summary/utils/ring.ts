import type { SpendingOverview } from '@contract/api.ts';
import type { ChartOption } from '@/shared/ui';
import type { RingPart, RowView } from '../types.ts';
import { totalFor } from './totals.ts';

// The ring: 184px across with a 14px band (CategoryRing's size-46). The canvas is HOVER_GROW px wider on every side so a
// widened segment stays inside it (the canvas clips what it does not hold).
export const HOVER_GROW = 4;
const RADIUS = [92 - 14, 92];

/**
 * The ring of the rows: each named row its own net; «Other» gets the rest of the total, so a refund-only category
 * (counted in the total, absent from the rows) never makes the ring larger than the total. Name, amount and share are
 * the list's own texts (the centre shows them on hover). Only the parts with spending: an index of the chart's data
 * is an index here.
 */
export function ringOf(rows: ReadonlyArray<RowView>, view: Readonly<SpendingOverview>, pick: number | null): RingPart[] {
  const netOf = (key: string) => {
    const c = view.categories.find((x) => x.category === key);
    if (!c) return 0;
    return pick === null ? c.net : (c.people.find((p) => p.participantId === pick)?.net ?? 0);
  };
  const partOf = (r: RowView, value: number): RingPart => ({ key: r.key, name: r.name, value, color: r.color, amount: r.amount, share: r.share });
  const named = rows.filter((r) => r.key !== 'rest').map((r) => partOf(r, netOf(r.key)));
  const rest = rows.find((r) => r.key === 'rest');
  const parts = rest ? [...named, partOf(rest, Math.max(0, totalFor(view, pick).net - named.reduce((s, p) => s + p.value, 0)))] : named;
  return parts.filter((p) => p.value > 0);
}

/** The ring for VChart: rounded segments with a gap over a sunken track; pointing widens one (the centre names it). */
export function ringOption(parts: ReadonlyArray<RingPart>): ChartOption {
  const track = {
    type: 'pie',
    radius: RADIUS,
    silent: true,
    label: { show: false },
    itemStyle: { color: 'var(--surface-sunken)' },
    data: [{ value: 1 }],
  };
  if (parts.length === 0) return { series: [track] };
  return {
    series: [
      track,
      {
        type: 'pie',
        radius: RADIUS,
        startAngle: 90,
        padAngle: parts.length > 1 ? 3 : 0,
        minAngle: 4,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderRadius: 7 },
        emphasis: { scale: true, scaleSize: HOVER_GROW },
        data: parts.map((p) => ({ name: p.name, value: p.value, itemStyle: { color: p.color } })),
      },
    ],
  };
}

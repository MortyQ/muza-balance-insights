import type { SpendingOverview } from '@contract/api.ts';
import { CHART_TOOLTIP } from '@/entities/operations';
import type { ChartOption } from '@/shared/ui';
import type { RingPart, RowView } from '../types.ts';
import { totalFor } from './totals.ts';

// The ring's band: 14px of the 184px ring (CategoryRing's size-46), as the inner radius in %.
const INNER = '84.8%';

/**
 * The ring of the rows: each named row its own net; «Other» gets the rest of the total, so a refund-only category
 * (counted in the total, absent from the rows) never makes the ring larger than the total. Name, amount and share are
 * the list's own texts (the tooltip repeats them).
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
  if (!rest) return named;
  return [...named, partOf(rest, Math.max(0, totalFor(view, pick).net - named.reduce((s, p) => s + p.value, 0)))];
}

/** The ring for VChart: rounded segments with a gap over a sunken track; pointing widens one and names it. */
export function ringOption(parts: ReadonlyArray<RingPart>): ChartOption {
  const shown = parts.filter((p) => p.value > 0);
  const track = {
    type: 'pie',
    radius: [INNER, '100%'],
    silent: true,
    label: { show: false },
    itemStyle: { color: 'var(--surface-sunken)' },
    data: [{ value: 1 }],
  };
  if (shown.length === 0) return { series: [track] };
  return {
    tooltip: { ...CHART_TOOLTIP, trigger: 'item', formatter: (p: { dataIndex: number }) => {
      const part = shown[p.dataIndex];
      return part ? `${part.name}\n${part.amount} · ${part.share}` : '';
    } },
    series: [
      track,
      {
        type: 'pie',
        radius: [INNER, '100%'],
        startAngle: 90,
        padAngle: shown.length > 1 ? 3 : 0,
        minAngle: 4,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderRadius: 7 },
        emphasis: { scale: true, scaleSize: 4 },
        data: shown.map((p) => ({ name: p.name, value: p.value, itemStyle: { color: p.color } })),
      },
    ],
  };
}

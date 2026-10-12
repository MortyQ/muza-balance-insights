import { computed, type ComputedRef } from 'vue';
import { t } from '@/shared/lib';
import type { RowView, SummaryView, UseSpendingReturn, UseSummaryViewReturn } from '../types.ts';
import {
  centerChip, centerConv, comparePeriodText, familyShareText, leftOutLines, noCompareText, opsVs, prevInText, ringOf, totalFor,
} from '../utils/index.ts';

/** The left column: the ring with its total, the comparison, the stats and the member card. */
export function useSummaryView(
  base: UseSpendingReturn,
  blockPick: ComputedRef<number | null>,
  who: ComputedRef<string>,
  rows: ComputedRef<RowView[]>,
): UseSummaryViewReturn {
  const { thisMonth, view, member, selected, fmt } = base;
  const summary = computed<SummaryView | null>(() => {
    const v = view.value;
    if (!v) return null;
    const total = totalFor(v, blockPick.value);
    const partial = v.compare?.partial ?? false;
    const compared = v.compare ? t('home.spending.compareFull', { period: comparePeriodText(v.compare, Number(thisMonth.value.slice(0, 4))) }) : '';
    const s = selected.value;
    return {
      ring: {
        stops: ringOf(rows.value, v, blockPick.value),
        label: who.value || t('home.spending.title'),
        amount: fmt.value.money(total.net),
        perDay: v.period.coveredDays > 0 ? t('home.spending.perDayShort', { amount: fmt.value.money(Math.round(total.net / v.period.coveredDays)) }) : null,
        chip: centerChip(total.net, total.prev?.net ?? null, v.month, partial),
        conv: centerConv(total.net, fmt.value),
      },
      compare: { none: v.compare ? '' : noCompareText(v.month), compared, leftOut: leftOutLines(v) },
      stats: {
        ops: total.purchases,
        opsVs: opsVs(total.purchases, total.prev?.purchases ?? null, v.month, partial),
        prev: total.prev ? { label: prevInText(v.month), title: partial ? compared : '', amount: fmt.value.money(total.prev.net) } : null,
      },
      member: member.value && s && v.familyTotal !== null
        ? { name: s.name, color: s.color, share: familyShareText(total.net, v.familyTotal), family: t('home.spending.familyTotal', { amount: fmt.value.money(v.familyTotal) }) }
        : null,
    };
  });
  return { summary };
}

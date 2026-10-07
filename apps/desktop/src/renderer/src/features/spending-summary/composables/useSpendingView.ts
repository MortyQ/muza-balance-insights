import { computed, type Ref } from 'vue';
import { monthName } from '@/shared/lib';
import type { SpendingPrefs, UseSpendingReturn, UseSpendingViewReturn } from '../types.ts';
import { leftOutLines } from '../utils/index.ts';
import { useCategoryRows } from './useCategoryRows.ts';
import { usePick } from './usePick.ts';
import { useSummaryView } from './useSummaryView.ts';

/** What the block shows for the loaded view, the in-block pick (family view only) and the menu choices. */
export function useSpendingView(base: UseSpendingReturn, prefs: Readonly<Ref<SpendingPrefs>>): UseSpendingViewReturn {
  const { month, state, view } = base;
  const { blockPick, who, people, onPick } = usePick(base);
  const hasData = computed(() => !!view.value && view.value.categories.some((c) => c.net > 0));
  const { rows, categories } = useCategoryRows(base, blockPick, who, hasData, prefs);
  const { summary } = useSummaryView(base, blockPick, who, rows);

  const subtitle = computed(() => [monthName(Number(month.value.slice(5, 7))), who.value].filter(Boolean).join(' · '));
  const empty = computed(() => !!view.value && state.value.status !== 'error' && !hasData.value && view.value.period.dataUntil !== null);
  const leftOut = computed(() => (view.value ? leftOutLines(view.value) : []));

  return { subtitle, hasData, empty, leftOut, summary, categories, people, onPick };
}

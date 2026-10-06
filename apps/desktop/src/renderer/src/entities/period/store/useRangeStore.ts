import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { shiftMonth, type YearMonth } from '@/shared/lib';
import { useMonthStore } from './useMonthStore.ts';

export type MonthRange = { from: YearMonth; to: YearMonth };

/** The analytics screen's period: whole months, independent of the home screen's month; lives while the app runs. */
export const useRangeStore = defineStore('period-range', () => {
  const months = useMonthStore();
  const last = shiftMonth(months.thisMonth, -1);
  // The last 12 whole months: the running one would end every line with a drop.
  const range = ref<MonthRange>({ from: shiftMonth(last, -11), to: last });
  const single = computed(() => range.value.from === range.value.to);

  /** Ordered, then kept inside [floor, this month]. */
  function set(next: MonthRange, floor: YearMonth): void {
    const [a, b] = next.from <= next.to ? [next.from, next.to] : [next.to, next.from];
    const clamp = (m: YearMonth): YearMonth => (m > months.thisMonth ? months.thisMonth : m < floor ? floor : m);
    range.value = { from: clamp(a), to: clamp(b) };
  }

  return { range, single, set };
});

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { kyivToday, monthOf, type YearMonth } from '@/shared/lib';

/** The month the home screen shows — one for the balance block and the spending block. */
export const useMonthStore = defineStore('period', () => {
  const thisMonth = monthOf(kyivToday(new Date()));
  const month = ref<YearMonth>(thisMonth);

  /** Sets the month, kept inside [first month with data, this month]. */
  function set(next: YearMonth, first: YearMonth | null): void {
    month.value = next > thisMonth ? thisMonth : first !== null && next < first ? first : next;
  }

  return { thisMonth, month, set };
});

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { kyivToday, monthOf, type YearMonth } from '@/shared/lib';

/** The month the home screen shows — one for the balance block and the spending block. */
export const useMonthStore = defineStore('period', () => {
  // Recomputed by `refresh()`, not just once at creation: otherwise the current month can't advance across a month
  // boundary while the app stays open.
  const now = ref(new Date());
  const thisMonth = computed(() => monthOf(kyivToday(now.value)));
  const month = ref<YearMonth>(thisMonth.value);

  /** Sets the month, kept inside [first month with data, this month]. */
  function set(next: YearMonth, first: YearMonth | null): void {
    month.value = next > thisMonth.value ? thisMonth.value : first !== null && next < first ? first : next;
  }

  /** Recomputes `thisMonth` for the current clock. The user's chosen `month` is left as is. */
  function refresh(): void {
    now.value = new Date();
  }

  return { thisMonth, month, set, refresh };
});

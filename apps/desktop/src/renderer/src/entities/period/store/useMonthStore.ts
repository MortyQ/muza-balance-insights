import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { localToday, monthOf, type YearMonth } from '@/shared/lib';

/** The month the home screen shows — one for the balance block and the spending block — and today's date (system time zone). */
export const useMonthStore = defineStore('period', () => {
  // Recomputed by `refresh()`, not just once at creation: otherwise the current month can't advance across a month
  // boundary while the app stays open.
  const now = ref(new Date());
  /** The local date of `now` (the now strip reloads when it changes). */
  const today = computed(() => localToday(now.value));
  const thisMonth = computed(() => monthOf(today.value));
  const month = ref<YearMonth>(thisMonth.value);

  /** Sets the month, kept inside [first month with data, this month]. */
  function set(next: YearMonth, first: YearMonth | null): void {
    month.value = next > thisMonth.value ? thisMonth.value : first !== null && next < first ? first : next;
  }

  /** Recomputes `thisMonth` and `today` for the current clock. The user's chosen `month` is left as is. */
  function refresh(): void {
    now.value = new Date();
  }

  return { thisMonth, today, month, set, refresh };
});

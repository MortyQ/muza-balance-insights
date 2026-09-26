import type { ComputedRef, Ref } from 'vue';
import type { Scope, SpendingView } from '@contract/api.ts';
import type { Loadable, YearMonth } from '@/shared/lib';

export interface UseSpendingReturn {
  thisMonth: YearMonth;
  month: Ref<YearMonth>;
  scope: Ref<Scope>;
  state: Readonly<Ref<Loadable<SpendingView>>>;
  view: ComputedRef<SpendingView | null>;
  periodNote: ComputedRef<string | null>;
  /** An import is running: the numbers grow window by window. */
  importing: ComputedRef<boolean>;
}

import { computed } from 'vue';
import type { UseSpendingInsightsReturn } from '../types.ts';
import { insightsView } from '../utils/index.ts';
import { useSpending } from './useSpending.ts';

/**
 * «What's unusual» for home's carousel tile: the same request as the spending block (the read cache answers it once),
 * worded. `loaded` — an answer is there, so an empty list means nothing unusual rather than not yet known.
 */
export function useSpendingInsights(): UseSpendingInsightsReturn {
  const { view, fmt, scope } = useSpending();
  return {
    insights: computed(() => (view.value ? insightsView(view.value, fmt.value, scope.value) : null)),
    loaded: computed(() => view.value !== null),
  };
}

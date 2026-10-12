import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type ShallowRef } from 'vue';
import { visibleCards } from '../utils.ts';

/** How many whole cards the row shows at the block's current width. */
export function useVisibleCards(block: Readonly<ShallowRef<HTMLElement | null>>): ComputedRef<number> {
  const width = ref(0);
  // Tests' DOM has no ResizeObserver: the row keeps its default size there.
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => (width.value = entry?.contentRect.width ?? 0));

  watch(
    block,
    (el) => {
      observer?.disconnect();
      if (el) observer?.observe(el);
      else width.value = 0;
    },
    { immediate: true, flush: 'post' },
  );
  onBeforeUnmount(() => observer?.disconnect());

  return computed(() => visibleCards(width.value));
}

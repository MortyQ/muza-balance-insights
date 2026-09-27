import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import type { UseCardStackReturn } from '../types.ts';
import { maxOffset } from '../utils.ts';

/**
 * The stack ⇄ row state of `count` balance cards; a new month or person pages the row back to its start, fewer cards
 * pull the offset back in range.
 */
export function useCardStack(count: MaybeRefOrGetter<number>): UseCardStackReturn {
  const participant = useParticipantStore();
  const monthStore = useMonthStore();
  const open = ref(false);
  const offset = ref(0);
  const paging = ref(false);
  const stubShown = ref(false);

  function toggle(): void {
    open.value = !open.value;
    offset.value = 0;
    paging.value = false;
    stubShown.value = false;
  }
  function close(): void {
    if (open.value) toggle();
  }
  function prev(): void {
    paging.value = true;
    offset.value = Math.max(0, offset.value - 1);
  }
  function next(): void {
    paging.value = true;
    offset.value = Math.min(maxOffset(toValue(count)), offset.value + 1);
  }
  function showStub(): void {
    stubShown.value = true;
  }

  watch([() => monthStore.month, () => participant.selectedId], () => {
    paging.value = true;
    offset.value = 0;
  });
  watch(
    () => toValue(count),
    (n) => {
      if (offset.value > maxOffset(n)) {
        paging.value = true;
        offset.value = maxOffset(n);
      }
    },
  );

  return { open, offset, paging, stubShown, toggle, close, prev, next, showStub };
}

import { ref, watch } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import type { UseCardStackReturn } from '../types.ts';
import { maxOffset } from '../utils.ts';

/** The stack ⇄ row state of the balance cards; a new month or person pages the row back to its start. */
export function useCardStack(): UseCardStackReturn {
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
  function next(n: number): void {
    paging.value = true;
    offset.value = Math.min(maxOffset(n), offset.value + 1);
  }
  function showStub(): void {
    stubShown.value = true;
  }

  watch([() => monthStore.month, () => participant.selectedId], () => {
    paging.value = true;
    offset.value = 0;
  });

  return { open, offset, paging, stubShown, toggle, close, prev, next, showStub };
}

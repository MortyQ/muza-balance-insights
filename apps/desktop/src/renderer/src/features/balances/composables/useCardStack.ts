import { ref, watch } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import type { UseCardStackReturn } from '../types.ts';

/**
 * The stack ⇄ row state of the balance cards. A new month or person changes the cards in place (no stagger) and calls
 * `onReset`, which brings the open row back to its start.
 */
export function useCardStack({ onReset }: { onReset?: () => void } = {}): UseCardStackReturn {
  const participant = useParticipantStore();
  const monthStore = useMonthStore();
  const open = ref(false);
  const paging = ref(false);
  const stubShown = ref(false);

  function toggle(): void {
    open.value = !open.value;
    paging.value = false;
    stubShown.value = false;
  }
  function close(): void {
    if (open.value) toggle();
  }
  function showStub(): void {
    stubShown.value = true;
  }

  watch([() => monthStore.month, () => participant.selectedId], () => {
    paging.value = true;
    onReset?.();
  });

  return { open, paging, stubShown, toggle, close, showStub };
}

import { onWatcherCleanup, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { DRAG_THRESHOLD } from '../constants.ts';
import type { UseDragScrollReturn } from '../types.ts';

/**
 * Mouse drag scrolls the row while `enabled`; touch and pen are left to native scrolling. A drag never ends in a click,
 * so it does not fold the row.
 */
export function useDragScroll(row: MaybeRefOrGetter<HTMLElement | null>, enabled: MaybeRefOrGetter<boolean>): UseDragScrollReturn {
  const dragging = ref(false);

  watch(
    () => [toValue(row), toValue(enabled)] as const,
    ([el, on]) => {
      if (!el || !on) return;
      let press: { id: number; x: number; left: number } | null = null;

      const swallowClick = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      const down = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        press = { id: e.pointerId, x: e.clientX, left: el.scrollLeft };
      };
      const move = (e: PointerEvent) => {
        if (!press || e.pointerId !== press.id) return;
        const dx = e.clientX - press.x;
        if (!dragging.value) {
          if (Math.abs(dx) < DRAG_THRESHOLD) return;
          dragging.value = true;
          el.setPointerCapture(e.pointerId);
        }
        e.preventDefault();
        el.scrollLeft = press.left - dx;
      };
      const up = (e: PointerEvent) => {
        if (!press || e.pointerId !== press.id) return;
        press = null;
        if (!dragging.value) return;
        dragging.value = false;
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        // The click that follows this release belongs to the drag; a timer drops the guard if no click comes.
        el.addEventListener('click', swallowClick, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', swallowClick, { capture: true }), 0);
      };

      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      onWatcherCleanup(() => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        dragging.value = false;
      });
    },
    { immediate: true, flush: 'post' },
  );

  return { dragging };
}

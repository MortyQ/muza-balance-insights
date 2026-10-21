import { computed, onWatcherCleanup, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { CARD_STEP, SCROLL_END_WAIT } from '../constants.ts';
import type { UseRowScrollReturn } from '../types.ts';
import { rowView } from '../utils.ts';

const behavior = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth');

/** The open row of `count` cards as a native scroller: where it stands, and moves by whole cards. */
export function useRowScroll(row: MaybeRefOrGetter<HTMLElement | null>, count: MaybeRefOrGetter<number>): UseRowScrollReturn {
  const scrollLeft = ref(0);
  const clientWidth = ref(0);
  const view = computed(() => rowView(scrollLeft.value, clientWidth.value, toValue(count)));

  function read(): void {
    const el = toValue(row);
    if (!el) return;
    scrollLeft.value = el.scrollLeft;
    clientWidth.value = el.clientWidth;
  }

  watch(
    () => toValue(row),
    (el) => {
      if (!el) return;
      read();
      let frame = 0;
      const onScroll = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          read();
        });
      };
      const resize = new ResizeObserver(read);
      el.addEventListener('scroll', onScroll, { passive: true });
      resize.observe(el);
      onWatcherCleanup(() => {
        el.removeEventListener('scroll', onScroll);
        resize.disconnect();
        cancelAnimationFrame(frame);
      });
    },
    { immediate: true, flush: 'post' },
  );
  watch(() => toValue(count), read, { flush: 'post' });

  function goTo(i: number): void {
    toValue(row)?.scrollTo({ left: Math.max(0, i) * CARD_STEP, behavior: behavior() });
  }

  function toStart(instant = false): Promise<void> {
    const el = toValue(row);
    if (!el || el.scrollLeft <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        el.removeEventListener('scrollend', done);
        clearTimeout(timer);
        read();
        resolve();
      };
      const timer = setTimeout(done, instant ? 0 : SCROLL_END_WAIT);
      el.addEventListener('scrollend', done);
      el.scrollTo({ left: 0, behavior: instant ? 'instant' : behavior() });
    });
  }

  return {
    view,
    prev: () => goTo(view.value.first - 1),
    next: () => goTo(view.value.first + 1),
    goTo,
    toStart,
  };
}

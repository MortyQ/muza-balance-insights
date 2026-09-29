import { computed, onBeforeUnmount, reactive, watch } from 'vue';
import { MAX_PARTICIPANT_BUTTONS, useParticipantStore } from '@/entities/participant';
import { ROW_GAP } from '../constants.ts';
import type { FilterRowParts, FilterRowWidths, UseParticipantLayoutReturn } from '../types.ts';
import { fitsCenter } from '../utils.ts';

/** Buttons in the middle of the row while there are few people and they fit; otherwise a select next to the month. */
export function useParticipantLayout(parts: FilterRowParts): UseParticipantLayoutReturn {
  const participant = useParticipantStore();
  const widths = reactive<FilterRowWidths>({ row: 0, left: 0, right: 0, center: 0 });
  const keys = Object.keys(widths) as Array<keyof FilterRowWidths>;
  const keyOf = new Map<Element, keyof FilterRowWidths>();

  const observer = new ResizeObserver((entries) => {
    for (const e of entries) {
      const key = keyOf.get(e.target);
      if (!key) continue;
      // The row: its content box (the columns share it); the parts: their whole box.
      widths[key] = key === 'row' ? e.contentRect.width : (e.borderBoxSize[0]?.inlineSize ?? e.contentRect.width);
    }
  });

  watch(
    () => keys.map((k) => parts[k].value),
    (els) => {
      observer.disconnect();
      keyOf.clear();
      els.forEach((el, i) => {
        const key = keys[i]!;
        if (el) {
          keyOf.set(el, key);
          observer.observe(el);
        } else widths[key] = 0;
      });
    },
    { immediate: true, flush: 'post' },
  );
  onBeforeUnmount(() => observer.disconnect());

  const mode = computed(() =>
    participant.people.length <= MAX_PARTICIPANT_BUTTONS && fitsCenter(widths, ROW_GAP) ? 'buttons' : 'select',
  );
  return { mode };
}

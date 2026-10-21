<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { AccountCard, SummaryCard } from '@/entities/account';
import { useDragScroll } from '../composables/useDragScroll.ts';
import type { RowView, Slide } from '../types.ts';
import { slideDelay, slidePosition } from '../utils.ts';
import FlowBars from './FlowBars.vue';

const { slides, open, paging, view } = defineProps<{
  slides: ReadonlyArray<Slide>;
  open: boolean;
  paging: boolean;
  /** The open row at its scroll: which edges fade. */
  view: RowView;
}>();
const emit = defineEmits<{ toggle: [] }>();
const row = useTemplateRef<HTMLElement>('row');
const { dragging } = useDragScroll(row, () => open);

/** Focus the front card (the first in row order): after the row folds back into the stack. */
function focusFront(): void {
  row.value?.querySelector('button')?.focus();
}
defineExpose({ focusFront, row });

/** A card reached by Tab in the open row is brought into view (the row has no scroll bar to show where it is). */
function onFocusIn(e: FocusEvent): void {
  if (!open || !(e.target instanceof HTMLElement)) return;
  e.target.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

const items = computed(() =>
  slides.map((slide, i) => {
    const p = slidePosition(i, open);
    // Folded, only the front card takes focus; the cards behind it are decoration for screen readers. Open, every card
    // does: the row scrolls to the focused one.
    const reachable = open || i === 0;
    return {
      slide,
      reachable,
      vars: { '--x': `${p.x}px`, '--y': `${p.y}px`, '--z': p.z, '--o': p.opacity, '--d': `${slideDelay(i, slides.length, open, paging)}ms` },
    };
  }),
);
const FADE = '32px';
const fades = computed(() => ({ '--fade-l': view.atStart ? '0px' : FADE, '--fade-r': view.atEnd ? '0px' : FADE }));
</script>

<template>
  <!-- Open, the row is a native scroller without a scroll bar: swipe, Shift + wheel, mouse drag; snaps to whole cards.
       The edge where more cards lie fades out. -->
  <div
    ref="row"
    data-test="row"
    class="relative -mx-1 -mt-2 h-[316px] px-1"
    :class="
      open
        ? [
            'overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none]',
            '[mask-image:linear-gradient(to_right,transparent,black_var(--fade-l),black_calc(100%-var(--fade-r)),transparent)]',
            dragging ? 'cursor-grabbing snap-none select-none' : 'snap-x snap-mandatory',
          ]
        : 'overflow-clip'
    "
    :style="fades"
    @focusin="onFocusIn"
  >
    <div
      v-for="s in items"
      :key="s.slide.key"
      class="absolute top-(--y) left-(--x) z-(--z) flex w-[400px] snap-start flex-col gap-3 opacity-(--o) transition-[left,top,opacity] delay-(--d) duration-550
             ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-opacity motion-reduce:duration-200"
      :style="s.vars"
      :aria-hidden="open || s.reachable ? undefined : 'true'"
    >
      <SummaryCard
        v-if="s.slide.kind === 'summary'"
        v-bind="s.slide.card"
        :aria-expanded="open"
        :tabindex="s.reachable ? undefined : -1"
        @click="emit('toggle')"
      />
      <AccountCard v-else v-bind="s.slide.card" :aria-expanded="open" :tabindex="s.reachable ? undefined : -1" @click="emit('toggle')" />
      <FlowBars
        :flow="s.slide.flow"
        class="transition-[opacity,translate] delay-150 duration-300 motion-reduce:translate-y-0"
        :class="open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'"
        :aria-hidden="!open"
      />
    </div>
  </div>
</template>

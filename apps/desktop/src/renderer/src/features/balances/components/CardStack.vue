<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { BalanceCard } from '@/entities/account';
import type { Slide } from '../types.ts';
import { slideDelay, slidePosition, WHEEL_IDLE, wheelSwipe } from '../utils.ts';
import FlowBars from './FlowBars.vue';

const { slides, open, offset, paging, visible } = defineProps<{
  slides: ReadonlyArray<Slide>;
  open: boolean;
  offset: number;
  paging: boolean;
  /** Whole cards the row shows. */
  visible: number;
}>();
const emit = defineEmits<{ toggle: []; page: [step: -1 | 1] }>();

// A sideways swipe over the open row pages it like the arrows; an up-and-down one is left to the screen's scroll.
let swipe = WHEEL_IDLE;
function onWheel(e: WheelEvent): void {
  const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
  if (!open || Math.abs(dx) <= Math.abs(e.shiftKey ? 0 : e.deltaY)) return;
  e.preventDefault();
  const next = wheelSwipe(swipe, dx, e.timeStamp);
  swipe = next.state;
  if (next.step !== 0) emit('page', next.step);
}
const row = useTemplateRef<HTMLElement>('row');

/** Focus the front card (the first in row order): after the row folds back into the stack. */
function focusFront(): void {
  row.value?.querySelector('button')?.focus();
}
defineExpose({ focusFront });

const items = computed(() =>
  slides.map(({ key, flow, ...card }, i) => {
    const p = slidePosition(i, open, offset);
    // Only cards in view take focus: the front card of the stack, the paged-in cards of the row. The cards behind the
    // front one are decoration for screen readers.
    const reachable = open ? i >= offset && i < offset + visible : i === 0;
    return {
      key,
      flow,
      card,
      reachable,
      vars: { '--x': `${p.x}px`, '--y': `${p.y}px`, '--z': p.z, '--o': p.opacity, '--d': `${slideDelay(i, slides.length, open, paging)}ms` },
    };
  }),
);
</script>

<template>
  <div ref="row" class="relative -mx-1 h-[270px] overflow-clip px-1" @wheel="onWheel">
    <div
      v-for="s in items"
      :key="s.key"
      class="absolute top-(--y) left-(--x) z-(--z) flex w-[340px] flex-col gap-3 opacity-(--o) transition-[left,top,opacity] delay-(--d) duration-550
             ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-opacity motion-reduce:duration-200"
      :style="s.vars"
      :aria-hidden="open || s.reachable ? undefined : 'true'"
    >
      <BalanceCard v-bind="s.card" :aria-expanded="open" :tabindex="s.reachable ? undefined : -1" @click="emit('toggle')" />
      <FlowBars
        :flow="s.flow"
        class="transition-[opacity,translate] delay-150 duration-300 motion-reduce:translate-y-0"
        :class="open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'"
        :aria-hidden="!open"
      />
    </div>
  </div>
</template>

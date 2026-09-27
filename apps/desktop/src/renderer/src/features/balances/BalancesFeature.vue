<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { VCard, VInfoNotice } from '@/shared/ui';
import BalancesHeader from './components/BalancesHeader.vue';
import CardStack from './components/CardStack.vue';
import MonthPanel from './components/MonthPanel.vue';
import { useCardStack } from './composables/useCardStack.ts';
import { useMonthOverview } from './composables/useMonthOverview.ts';
import { accountsCount, coverageNote, maxOffset } from './utils.ts';

const { state, view, slides, isFamily, legend, month, monthName, thisMonth, currentYear, firstMonth } = useMonthOverview();
const stack = useCardStack(() => slides.value.length);
const { open, offset, paging, stubShown } = stack;
const block = useTemplateRef<HTMLElement>('block');
const cards = useTemplateRef<{ focusFront: () => void }>('cards');

/** Folds the row back; focus inside the block (now on a control that goes inert) moves to the front card. */
function collapse(): void {
  if (!open.value) return;
  const inside = block.value?.contains(document.activeElement) ?? false;
  stack.close();
  if (inside) void nextTick(() => cards.value?.focusFront());
}
function onCard(): void {
  if (open.value) collapse();
  else stack.toggle();
}

const head = computed(() => slides.value[0] ?? null);
const openTitle = computed(() => (isFamily.value ? 'Карты семьи' : `Счета · ${head.value?.title ?? ''}`));
const openSubtitle = computed(() => (isFamily.value ? 'общий итог и каждый человек' : accountsCount(view.value?.total.accounts ?? 0)));
const note = computed(() => (view.value ? coverageNote(view.value.month, view.value.coverage) : ''));
</script>

<template>
  <VCard padding="md" @keydown.esc="collapse">
    <VInfoNotice v-if="state.status === 'error' && !view" :card="false" icon="lucide:circle-alert" tone="danger" subtitle="Не удалось прочитать балансы." />
    <div v-else ref="block" class="flex flex-col gap-3">
      <BalancesHeader
        v-model="month"
        :open
        :title="openTitle"
        :subtitle="openSubtitle"
        :min="firstMonth ?? undefined"
        :max="thisMonth"
        :current-year
        :can-prev="offset > 0"
        :can-next="offset < maxOffset(slides.length)"
        @prev="stack.prev"
        @next="stack.next"
        @stub="stack.showStub"
        @close="collapse"
      />
      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" subtitle="Не удалось прочитать балансы." />
      <div v-if="head" class="relative transition-opacity" :class="{ 'opacity-60': state.status === 'loading' }">
        <CardStack ref="cards" :slides :open :offset :paging @toggle="onCard" />
        <MonthPanel
          class="absolute top-0 right-0 h-[266px] w-[340px] [transition:opacity_.3s_ease,translate_.4s_cubic-bezier(.2,.8,.2,1)]
                 motion-reduce:translate-x-0 motion-reduce:[transition:opacity_.2s_ease]"
          :class="open ? 'pointer-events-none translate-x-8 opacity-0' : 'opacity-100'"
          :inert="open"
          :title="monthName"
          :note
          :flow="head.flow"
          :legend
          :stub-shown
          @stub="stack.showStub"
        />
      </div>
      <p v-if="open && stubShown" class="text-right text-xs text-foreground-muted" role="status">«Все счета» — раздел появится позже</p>
    </div>
  </VCard>
</template>

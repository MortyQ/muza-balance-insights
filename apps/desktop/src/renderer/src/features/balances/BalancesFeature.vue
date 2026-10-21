<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { t } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import BalancesHeader from './components/BalancesHeader.vue';
import CardStack from './components/CardStack.vue';
import MonthPanel from './components/MonthPanel.vue';
import { useCardStack } from './composables/useCardStack.ts';
import { useMonthOverview } from './composables/useMonthOverview.ts';
import { accountsCount, coverageNote, maxOffset } from './utils.ts';

const { state, view, slides, isFamily, legend, monthName } = useMonthOverview();
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
const openTitle = computed(() => (isFamily.value ? t('home.balances.familyCards') : t('home.balances.accountsOf', { name: head.value?.title ?? '' })));
const openSubtitle = computed(() => (isFamily.value ? t('home.balances.familySubtitle') : accountsCount(view.value?.total.accounts ?? 0)));
const note = computed(() => (view.value ? coverageNote(view.value.month, view.value.coverage) : ''));
</script>

<template>
  <VCard padding="md" @keydown.esc="collapse">
    <VInfoNotice v-if="state.status === 'error' && !view" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.balances.readFailed')" />
    <div v-else ref="block" class="flex flex-col gap-3">
      <BalancesHeader
        :open
        :title="openTitle"
        :subtitle="openSubtitle"
        :can-prev="offset > 0"
        :can-next="offset < maxOffset(slides.length)"
        @prev="stack.prev"
        @next="stack.next"
        @stub="stack.showStub"
        @close="collapse"
      />
      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.balances.readFailed')" />
      <!-- The panel beside the stack while both fit (constants.ts: STACK_WIDTH + PANEL_GAP + PANEL_MIN), under it
           otherwise; under the stack it folds away with the open row so no empty space is left. -->
      <div v-if="head" class="@container relative transition-opacity" :class="{ 'opacity-60': state.status === 'loading' }">
        <CardStack ref="cards" :slides :open :offset :paging @toggle="onCard" />
        <div
          data-test="panel"
          class="grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none
                 @[44rem]:absolute @[44rem]:inset-y-0 @[44rem]:right-0 @[44rem]:left-[430px] @[44rem]:grid-rows-[1fr]! @[44rem]:overflow-visible!"
          :class="open ? 'grid-rows-[0fr] overflow-hidden' : 'grid-rows-[1fr]'"
          :inert="open"
        >
          <div class="min-h-0">
            <MonthPanel
              class="pt-4 [transition:opacity_.3s_ease,translate_.4s_cubic-bezier(.2,.8,.2,1)] motion-reduce:translate-x-0
                     motion-reduce:[transition:opacity_.2s_ease] @[44rem]:ml-auto @[44rem]:h-[266px] @[44rem]:max-w-[340px] @[44rem]:pt-0"
              :class="open ? 'pointer-events-none translate-x-8 opacity-0' : 'opacity-100'"
              :title="monthName"
              :note
              :flow="head.flow"
              :legend
              :stub-shown
              @stub="stack.showStub"
            />
          </div>
        </div>
      </div>
      <p v-if="open && stubShown" class="text-right text-xs text-foreground-muted" role="status">{{ $t('home.balances.stubLater') }}</p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { t } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import BalancesHeader from './components/BalancesHeader.vue';
import CardStack from './components/CardStack.vue';
import MonthPanel from './components/MonthPanel.vue';
import PacePanel from './components/PacePanel.vue';
import RowDots from './components/RowDots.vue';
import { useCardStack } from './composables/useCardStack.ts';
import { useMonthOverview } from './composables/useMonthOverview.ts';
import { useMonthPace } from './composables/useMonthPace.ts';
import { useRowScroll } from './composables/useRowScroll.ts';
import { accountsCount, coverageNote } from './utils.ts';

const { state, view, slides, isFamily, legend, monthName } = useMonthOverview();
const pace = useMonthPace();
const block = useTemplateRef<HTMLElement>('block');
const cards = useTemplateRef<{ focusFront: () => void; row: HTMLElement | null }>('cards');
const scroll = useRowScroll(() => cards.value?.row ?? null, () => slides.value.length);
const stack = useCardStack({ onReset: () => void scroll.toStart(true) });
const { open, paging, stubShown } = stack;
const row = scroll.view;
let folding = false;

/**
 * Folds the row back: first to its start, then into the stack. Focus inside the block (now on a control that goes
 * inert) moves to the front card.
 */
async function collapse(): Promise<void> {
  if (!open.value || folding) return;
  folding = true;
  const inside = block.value?.contains(document.activeElement) ?? false;
  await scroll.toStart();
  folding = false;
  stack.close();
  if (inside) void nextTick(() => cards.value?.focusFront());
}
function onCard(): void {
  if (open.value) void collapse();
  else stack.toggle();
}

const head = computed(() => slides.value[0] ?? null);
const openTitle = computed(() => (isFamily.value ? t('home.balances.familyCards') : t('home.balances.accountsOf', { name: head.value?.card.title ?? '' })));
const openSubtitle = computed(() => (isFamily.value ? t('home.balances.familySubtitle') : accountsCount(view.value?.total.accounts ?? 0)));
const titles = computed(() => slides.value.map((s) => s.card.title));
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
        :can-prev="!row.atStart"
        :can-next="!row.atEnd"
        @prev="scroll.prev"
        @next="scroll.next"
        @stub="stack.showStub"
        @close="collapse"
      />
      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.balances.readFailed')" />
      <!-- The panel beside the stack while both fit (constants.ts: STACK_WIDTH + PANEL_GAP + PANEL_MIN), under it
           otherwise; under the stack it folds away with the open row so no empty space is left. -->
      <div v-if="head" class="@container relative transition-opacity" :class="{ 'opacity-60': state.status === 'loading' }">
        <CardStack ref="cards" :slides :open :paging :view="row" @toggle="onCard" />
        <RowDots :titles :first="row.first" :last="row.last" :shown="open && !row.fits" @go="scroll.goTo" />
        <div
          data-test="panel"
          class="grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none
                 @[47rem]:absolute @[47rem]:top-0 @[47rem]:right-0 @[47rem]:left-[490px] @[47rem]:grid-rows-[1fr]! @[47rem]:overflow-visible!
                 @[74rem]:right-auto @[74rem]:w-[340px]"
          :class="open ? 'grid-rows-[0fr] overflow-hidden' : 'grid-rows-[1fr]'"
          :inert="open"
        >
          <div class="min-h-0">
            <MonthPanel
              class="pt-4 [transition:opacity_.3s_ease,translate_.4s_cubic-bezier(.2,.8,.2,1)] motion-reduce:translate-x-0
                     motion-reduce:[transition:opacity_.2s_ease] @[47rem]:ml-auto @[47rem]:h-[304px] @[47rem]:max-w-[340px] @[47rem]:pt-0"
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
        <!-- The month pace (spec desktop-balance-cards): beside the month panel from @[74rem] (constants.ts: PACE_MIN),
             under the stack and the panel otherwise, folding with the open row there. -->
        <div
          v-if="pace.view.value"
          data-test="pace"
          class="grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none
                 @[74rem]:absolute @[74rem]:top-0 @[74rem]:right-0 @[74rem]:left-[854px] @[74rem]:grid-rows-[1fr]! @[74rem]:overflow-visible!"
          :class="open ? 'grid-rows-[0fr] overflow-hidden' : 'grid-rows-[1fr]'"
          :inert="open"
        >
          <div class="min-h-0">
            <PacePanel
              class="pt-4 [transition:opacity_.3s_ease] motion-reduce:[transition:opacity_.2s_ease]
                     @[74rem]:h-[304px] @[74rem]:border-l @[74rem]:border-border-subtle @[74rem]:pt-0 @[74rem]:pl-6"
              :class="open ? 'pointer-events-none opacity-0' : 'opacity-100'"
              :view="pace.view.value"
              :fmt="pace.fmt.value"
            />
          </div>
        </div>
      </div>
      <p v-if="open && stubShown" class="text-right text-xs text-foreground-muted" role="status">{{ $t('home.balances.stubLater') }}</p>
    </div>
  </VCard>
</template>

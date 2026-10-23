<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { t } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import BalancesHeader from './components/BalancesHeader.vue';
import CardStack from './components/CardStack.vue';
import FreeLine from './components/FreeLine.vue';
import MonthPanel from './components/MonthPanel.vue';
import PacePanel from './components/PacePanel.vue';
import RowDots from './components/RowDots.vue';
import { useCardStack } from './composables/useCardStack.ts';
import { useMonthOverview } from './composables/useMonthOverview.ts';
import { useMonthPace } from './composables/useMonthPace.ts';
import { useRowScroll } from './composables/useRowScroll.ts';
import { accountsCount, coverageNote, freeLineOf } from './utils.ts';

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
const free = computed(() => freeLineOf(slides.value[open.value ? row.value.first : 0] ?? null));
const note = computed(() => (view.value ? coverageNote(view.value.month, view.value.coverage) : ''));
</script>

<template>
  <div class="contents" @keydown.esc="collapse">
    <!-- Three tiles of the home grid (spec desktop-home-tiles): «Balance» (the stack), «Month pace», «Month». The root
         is `contents`, so the tiles are the grid's own items and the page orders them. Opening the row widens «Balance»
         to the whole row; the other two stay mounted but hidden and inert, so they come back without reloading. -->
    <VCard padding="md" data-test="balance-tile" :class="open ? 'col-span-full' : '@[47rem]:col-span-2 @[74rem]:col-span-1'">
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
        <div v-if="head" class="relative transition-opacity" :class="{ 'opacity-60': state.status === 'loading' }">
          <CardStack ref="cards" :slides :open :paging :view="row" @toggle="onCard" />
          <RowDots :titles :first="row.first" :last="row.last" :shown="open && !row.fits" @go="scroll.goTo" />
        </div>
        <FreeLine v-if="free" :line="free" />
        <p v-if="open && stubShown" class="text-right text-xs text-foreground-muted" role="status">{{ $t('home.balances.stubLater') }}</p>
      </div>
    </VCard>
    <VCard v-if="pace.view.value" v-show="!open" :inert="open" padding="md" class="min-w-0" data-test="pace">
      <!-- min-w-0: a grid item never shrinks below its content, so the chart's canvas would keep its old width. -->
      <PacePanel class="h-full min-w-0" :view="pace.view.value" :fmt="pace.fmt.value" />
    </VCard>
    <VCard v-if="head" v-show="!open" :inert="open" padding="md" data-test="panel">
      <MonthPanel class="h-full" :title="monthName" :note :flow="head.flow" :legend :stub-shown @stub="stack.showStub" />
    </VCard>
  </div>
</template>

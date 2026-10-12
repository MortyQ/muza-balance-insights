<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { t } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import BalancesHeader from './components/BalancesHeader.vue';
import CardStack from './components/CardStack.vue';
import MonthPanel from './components/MonthPanel.vue';
import { useCardStack } from './composables/useCardStack.ts';
import { useMonthOverview } from './composables/useMonthOverview.ts';
import { useVisibleCards } from './composables/useVisibleCards.ts';
import { accountsCount, coverageNote, maxOffset } from './utils.ts';

const { state, view, slides, isFamily, legend, monthName } = useMonthOverview();
const block = useTemplateRef<HTMLElement>('block');
// As many cards in the row as the block is wide.
const visible = useVisibleCards(block);
const stack = useCardStack(() => slides.value.length, visible);
const { open, offset, paging, stubShown } = stack;
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
    <div v-else ref="block" class="@container flex flex-col gap-3">
      <BalancesHeader
        :open
        :title="openTitle"
        :subtitle="openSubtitle"
        :can-prev="offset > 0"
        :can-next="offset < maxOffset(slides.length, visible)"
        @prev="stack.prev"
        @next="stack.next"
        @stub="stack.showStub"
        @close="collapse"
      />
      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.balances.readFailed')" />
      <div v-if="head" class="relative transition-opacity" :class="{ 'opacity-60': state.status === 'loading' }">
        <CardStack ref="cards" :slides :open :offset :paging :visible @toggle="onCard" @page="$event > 0 ? stack.next() : stack.prev()" />
        <!-- Beside the stack (406px with the cards peeking out) while the block is wide enough for both; under it
             otherwise, and then gone while the row is open. -->
        <MonthPanel
          class="mt-4 [transition:opacity_.3s_ease,translate_.4s_cubic-bezier(.2,.8,.2,1)] motion-reduce:translate-x-0
                 motion-reduce:[transition:opacity_.2s_ease] @[44rem]:absolute @[44rem]:top-0 @[44rem]:right-0 @[44rem]:mt-0
                 @[44rem]:h-[266px] @[44rem]:w-[min(30rem,calc(100%-438px))]"
          :class="open ? 'pointer-events-none translate-x-8 opacity-0 @max-[44rem]:hidden' : 'opacity-100'"
          :inert="open"
          :title="monthName"
          :note
          :flow="head.flow"
          :legend
          :stub-shown
          @stub="stack.showStub"
        />
      </div>
      <p v-if="open && stubShown" class="text-right text-xs text-foreground-muted" role="status">{{ $t('home.balances.stubLater') }}</p>
    </div>
  </VCard>
</template>

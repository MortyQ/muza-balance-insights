<script setup lang="ts">
import { computed, useId } from 'vue';
import { useSyncStatusStore } from '@/entities/sync-status';
import { VCard, VInfoNotice } from '@/shared/ui';
import BalancesHeader from './components/BalancesHeader.vue';
import CardStack from './components/CardStack.vue';
import MonthPanel from './components/MonthPanel.vue';
import { useCardStack } from './composables/useCardStack.ts';
import { useMonthOverview } from './composables/useMonthOverview.ts';
import { accountsCount, coverageNote, maxOffset } from './utils.ts';

const { state, view, slides, isFamily, legend, month, monthName, thisMonth, currentYear, firstMonth } = useMonthOverview();
const stack = useCardStack();
const { open, offset, paging, stubShown } = stack;
const syncStatus = useSyncStatusStore();
const rowId = useId();

const head = computed(() => slides.value[0] ?? null);
const openTitle = computed(() => (isFamily.value ? 'Карты семьи' : `Счета · ${head.value?.title ?? ''}`));
const openSubtitle = computed(() => (isFamily.value ? 'общий итог и каждый человек' : accountsCount(view.value?.accounts.length ?? 0)));
const note = computed(() => (view.value ? coverageNote(view.value.month, view.value.coverage) : ''));
</script>

<template>
  <VCard padding="md" @keydown.esc="stack.close">
    <VInfoNotice v-if="state.status === 'error' && !view" :card="false" icon="lucide:circle-alert" tone="danger" subtitle="Не удалось прочитать балансы." />
    <p v-else-if="!syncStatus.hasData" class="text-foreground-muted">Счетов пока нет: загрузи выписку в разделе «Импорт».</p>
    <div v-else class="flex flex-col gap-3">
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
        @next="stack.next(slides.length)"
        @stub="stack.showStub"
        @close="stack.close"
      />
      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" subtitle="Не удалось прочитать балансы." />
      <div v-if="head" class="relative transition-opacity" :class="{ 'opacity-60': state.status === 'loading' }">
        <CardStack :slides :open :offset :paging :row-id @toggle="stack.toggle" />
        <MonthPanel
          class="absolute top-0 left-[452px] h-[266px] w-[340px] transition-[opacity,translate] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]
                 motion-reduce:translate-x-0"
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

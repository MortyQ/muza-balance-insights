<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { categoryLink } from '@/shared/config';
import { VCard, VIcon, VInfoNotice } from '@/shared/ui';
import CategoryRing from './components/CategoryRing.vue';
import CategoryRow from './components/CategoryRow.vue';
import PeopleList from './components/PeopleList.vue';
import SpendingHeader from './components/SpendingHeader.vue';
import { OPS_TONE } from './constants.ts';
import { useSpending } from './composables/useSpending.ts';
import { useSpendingView } from './composables/useSpendingView.ts';
import { useSpendingPrefsStore } from './store/useSpendingPrefsStore.ts';

const base = useSpending();
const { scope, state, view, periodNote, importing, family } = base;
const prefsStore = useSpendingPrefsStore();
const { prefs } = storeToRefs(prefsStore);
const {
  who, subtitle, hasData, rows, noneBy, total, ring, chip, conv, perDay, whoRows, leftOut, noCompare, compared, prevIn, prevInTitle, opsVs, memberCard, money, onPick,
} = useSpendingView(base, prefs);
</script>

<template>
  <VCard padding="md">
    <div class="@container flex flex-col gap-4">
      <SpendingHeader v-model:scope="scope" :subtitle :prefs :family @set="prefsStore.set" />

      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.spending.failed')" />
      <VInfoNotice v-else-if="periodNote" :card="false" icon="lucide:info" tone="info" :subtitle="periodNote" />
      <p v-if="importing" class="text-sm text-foreground-muted">{{ $t('home.spending.importing') }}</p>
      <p v-if="view && view.period.pendingHolds > 0" class="flex items-center gap-1.5 text-sm text-warning">
        <VIcon icon="lucide:clock" class="size-3.5 shrink-0" />
        {{ $t('home.spending.pending', { count: view.period.pendingHolds }) }}
      </p>
      <template v-if="view && state.status !== 'error' && !hasData && view.period.dataUntil !== null">
        <p class="text-foreground-muted">{{ $t('home.spending.empty') }}</p>
        <p v-for="l in leftOut" :key="l" class="text-sm text-foreground-muted">{{ l }}</p>
      </template>

      <div v-if="view && total && hasData" class="flex flex-col gap-7 @3xl:flex-row" :class="{ 'opacity-60': state.status === 'loading' }">
        <div class="flex w-full flex-col gap-3 @3xl:w-59 @3xl:shrink-0">
          <CategoryRing :stops="ring" :label="who || $t('home.spending.title')" :amount="money(total.net)" :per-day :chip :conv />
          <p v-if="noCompare" class="text-center text-xs text-foreground-muted">{{ noCompare }}</p>
          <p v-else-if="compared" class="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-foreground-secondary">
            <VIcon icon="lucide:calendar-range" class="size-3.5 shrink-0" />
            {{ compared }}
          </p>
          <p v-for="l in leftOut" :key="l" class="text-center text-xs text-foreground-muted">{{ l }}</p>
          <div class="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3.5">
            <div class="flex flex-col gap-0.5">
              <span class="text-xs text-foreground-muted">{{ $t('home.spending.operations') }}</span>
              <span class="flex items-baseline gap-1.5 whitespace-nowrap">
                <span class="text-lg font-bold tabular-nums">{{ total.purchases }}</span>
                <span class="text-xs font-bold tabular-nums" :class="OPS_TONE[opsVs.tone]">{{ opsVs.text }}<span v-if="opsVs.sr" class="sr-only"> {{ opsVs.sr }}</span></span>
              </span>
            </div>
            <div v-if="total.prev" class="flex flex-col gap-0.5" :title="prevInTitle || undefined">
              <span class="text-xs text-foreground-muted">{{ prevIn }}</span>
              <span class="whitespace-nowrap text-lg font-bold tabular-nums">{{ money(total.prev.net) }}</span>
            </div>
          </div>
          <PeopleList v-if="family" :rows="whoRows" @pick="onPick" />
          <div v-if="memberCard" class="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-raised p-2.5">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-(--c) text-base font-extrabold text-white" :style="{ '--c': memberCard.color }" aria-hidden="true">
              {{ memberCard.initial }}
            </span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="font-semibold">{{ memberCard.share }}</span>
              <span class="whitespace-nowrap text-xs text-foreground-muted">{{ memberCard.family }}</span>
            </span>
          </div>
        </div>
        <div class="flex min-w-0 grow flex-col gap-0.5">
          <p v-if="noneBy" class="px-2.5 py-3 text-foreground-muted">{{ noneBy }}</p>
          <CategoryRow v-for="r in rows" :key="r.key" :row="r" :to="r.categoryId ? categoryLink(r.categoryId, scope) : null" />
        </div>
      </div>

      <p v-if="hasData" class="text-sm text-foreground-muted">{{ $t('home.spending.footnote') }}</p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DetailSkeleton } from '@/entities/operations';
import { currencySymbol } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import AnalyticsKpis from './components/AnalyticsKpis.vue';
import CategoryViews from './components/CategoryViews.vue';
import ChangesList from './components/ChangesList.vue';
import FlowChart from './components/FlowChart.vue';
import { useAnalytics } from './composables/useAnalytics.ts';
import { changesView, comparedText, kpiView } from './utils.ts';

const { state, view, rows, fmt, current, on, hover, mode, showOnly, toggle, top, all } = useAnalytics();
const kpis = computed(() => (view.value ? kpiView(view.value, fmt.value) : []));
const changes = computed(() => (view.value ? changesView(view.value, fmt.value) : []));
const empty = computed(() => view.value !== null && view.value.totals.income === 0 && view.value.totals.spending === 0);
const vs = computed(() => (view.value?.compare ? comparedText(view.value.compare) : ''));
const leftOut = computed(() => (view.value?.leftOut ?? []).map(currencySymbol).join(', '));
</script>

<template>
  <div class="@container flex flex-col gap-4">
    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('analytics.failed')" />

    <DetailSkeleton v-if="!view && state.status === 'loading'" />
    <template v-else-if="view">
      <div class="flex flex-col gap-4" :class="{ 'opacity-60': state.status === 'loading' }">
        <AnalyticsKpis :items="kpis" />
        <p v-if="empty" class="text-foreground-muted">{{ $t('analytics.empty') }}</p>
        <template v-else>
          <div class="flex flex-wrap items-stretch gap-4">
            <VCard padding="md" class="min-w-0 flex-[999_1_34rem]"><FlowChart :view :fmt /></VCard>
            <VCard padding="md" class="min-w-0 flex-[1_1_18rem]">
              <ChangesList
                :rows="changes"
                :vs="vs ? $t('analytics.changes.vs', { period: vs }) : ''"
                :can-compare="view.compare !== null"
                @open="showOnly"
                @all="current = 'compare'"
              />
            </VCard>
          </div>
          <VCard padding="md">
            <CategoryViews
              v-model:current="current"
              v-model:hover="hover"
              v-model:mode="mode"
              :view
              :rows
              :on
              :fmt
              @toggle="toggle"
              @top="top"
              @all="all"
            />
          </VCard>
        </template>
      </div>
      <p v-if="leftOut" class="text-sm text-foreground-muted">{{ $t('analytics.leftOut', { currencies: leftOut }) }}</p>
      <p class="text-sm text-foreground-muted">{{ $t('analytics.footnote') }}</p>
    </template>
  </div>
</template>

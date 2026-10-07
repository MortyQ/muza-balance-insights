<script setup lang="ts">
import { BackLink, DetailSkeleton, DetailSummary, MonthsChart, OperationList, PeopleBars, ShareList, WhenCharts } from '@/entities/operations';
import { VCard, VInfoNotice } from '@/shared/ui';
import SourceBars from './components/SourceBars.vue';
import { useIncomeDetail } from './composables/useIncomeDetail.ts';
import { useIncomeView } from './composables/useIncomeView.ts';
import { INCOME_COLOR } from './constants.ts';

const base = useIncomeDetail();
const { state, view } = base;
const { summary, none, months, people, sources, senders, moreSenders, when, rows, total, sender, senderName, query, sort, pickSender } = useIncomeView(base);
</script>

<template>
  <div class="@container flex flex-col gap-4" :style="{ '--cat': INCOME_COLOR }">
    <BackLink :label="$t('income.back')" />

    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('income.failed')" />

    <DetailSkeleton v-if="!view && state.status === 'loading'" />
    <template v-else-if="view && summary">
      <VCard padding="md" :class="{ 'opacity-60': state.status === 'loading' }">
        <DetailSummary :summary :label="$t('income.summary.received')" />
      </VCard>
      <p v-if="none" class="text-foreground-muted">{{ none }}</p>
      <VCard v-if="months" padding="md"><MonthsChart :months :title="$t('entities.operations.months.title')" /></VCard>
      <!-- As on the category screen: the senders on the left, «Where from», «When» and «Who received» stacked on the right. -->
      <div v-if="view.lines.length > 0" class="grid gap-4 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VCard padding="md" class="min-w-0">
          <ShareList :items="senders" :more="moreSenders" :title="$t('income.from.title')" @pick="pickSender" />
        </VCard>
        <div class="flex min-w-0 flex-col gap-4">
          <VCard v-if="sources.length > 0" padding="md"><SourceBars :sources /></VCard>
          <!-- The column's last card takes the rest of its height: «Who received», or «When» when there is no one else. -->
          <VCard v-if="when" padding="md" :class="{ grow: people.length <= 1 }"><WhenCharts :when /></VCard>
          <VCard v-if="people.length > 1" padding="md" class="grow"><PeopleBars :people :title="$t('income.who.title')" /></VCard>
        </div>
      </div>
      <VCard v-if="view.lines.length > 0" padding="md">
        <OperationList
          v-model:query="query"
          v-model:sort="sort"
          :rows
          :total
          :filter-name="senderName"
          :where-label="$t('income.list.from')"
          :search-label="$t('income.list.search')"
          @clear="sender = null"
        />
      </VCard>
      <p class="text-sm text-foreground-muted">{{ $t('income.footnote') }}</p>
    </template>
  </div>
</template>

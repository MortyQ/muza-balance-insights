<script setup lang="ts">
import { toRef } from 'vue';
import type { DetailPeriod, Scope } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { bankOf, BankMark } from '@/entities/bank';
import { BackLink, DetailSkeleton, DetailSummary, MonthsChart, OperationList, PartBars, PeopleBars, ShareList, WhenCharts } from '@/entities/operations';
import { VCard, VInfoNotice } from '@/shared/ui';
import { useCategoryDetail } from './composables/useCategoryDetail.ts';
import { useCategoryView } from './composables/useCategoryView.ts';

const { categoryId, scope, period } = defineProps<{ categoryId: CategoryId; scope: Scope; period: DetailPeriod }>();

const base = useCategoryDetail(() => categoryId, () => scope, () => period);
const { state, view } = base;
const { summary, label, none, months, people, banks, merchants, moreMerchants, when, rows, total, merchant, merchantName, query, sort, pickMerchant } = useCategoryView(base, toRef(() => scope));
</script>

<template>
  <div class="@container flex flex-col gap-4" :style="{ '--cat': summary?.color ?? 'var(--category-other)' }">
    <BackLink :label="$t('category.back')" />

    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('category.failed')" />

    <DetailSkeleton v-if="!view && state.status === 'loading'" :months="period.kind === 'month'" />
    <template v-else-if="view && summary">
      <VCard padding="md" :class="{ 'opacity-60': state.status === 'loading' }">
        <DetailSummary :summary :label />
      </VCard>
      <p v-if="none" class="text-foreground-muted">{{ none }}</p>
      <VCard v-if="months" padding="md"><MonthsChart :months :title="$t('entities.operations.months.title')" /></VCard>
      <!-- Two columns from the container's @3xl (the content column is at most 52rem): the merchants' list on the left,
           «When», «Who spent» and «By bank» stacked on the right, so the two sides come out about as tall. -->
      <div v-if="view.lines.length > 0" class="grid gap-4 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VCard padding="md" class="min-w-0"><ShareList :items="merchants" :more="moreMerchants" :title="$t('category.where.title')" @pick="pickMerchant" /></VCard>
        <div class="flex min-w-0 flex-col gap-4">
          <!-- The column's last card takes the rest of its height: «By bank», else «Who spent», else «When». -->
          <VCard v-if="when" padding="md" :class="{ grow: people.length <= 1 && banks.length <= 1 }"><WhenCharts :when /></VCard>
          <VCard v-if="people.length > 1" padding="md" :class="{ grow: banks.length <= 1 }"><PeopleBars :people :title="$t('category.who.title')" /></VCard>
          <VCard v-if="banks.length > 1" padding="md" class="grow">
            <PartBars :parts="banks" :title="$t('entities.operations.banks.title')">
              <template #mark="{ part }"><BankMark :bank="bankOf(String(part.key))" size="sm" /></template>
            </PartBars>
          </VCard>
        </div>
      </div>
      <VCard v-if="view.lines.length > 0" padding="md">
        <OperationList
          v-model:query="query"
          v-model:sort="sort"
          :rows
          :total
          :filter-name="merchantName"
          :where-label="$t('category.list.col.where')"
          :search-label="$t('category.list.search')"
          @clear="merchant = null"
        />
      </VCard>
      <p class="text-sm text-foreground-muted">{{ $t('category.footnote') }}</p>
    </template>
  </div>
</template>

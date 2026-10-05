<script setup lang="ts">
import { toRef } from 'vue';
import { RouterLink } from 'vue-router';
import type { Scope } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { ROUTE } from '@/shared/config';
import { VCard, VIcon, VInfoNotice } from '@/shared/ui';
import CategorySummary from './components/CategorySummary.vue';
import MerchantList from './components/MerchantList.vue';
import MonthsChart from './components/MonthsChart.vue';
import TransactionList from './components/TransactionList.vue';
import WhenCharts from './components/WhenCharts.vue';
import WhoSpent from './components/WhoSpent.vue';
import { useCategoryDetail } from './composables/useCategoryDetail.ts';
import { useCategoryView } from './composables/useCategoryView.ts';

const { categoryId, scope } = defineProps<{ categoryId: CategoryId; scope: Scope }>();

const base = useCategoryDetail(() => categoryId, () => scope);
const { state, view } = base;
const { summary, none, months, people, merchants, moreMerchants, when, rows, total, merchant, merchantName, query, sort, pickMerchant } = useCategoryView(base, toRef(() => scope));
</script>

<template>
  <div class="@container flex flex-col gap-4" :style="{ '--cat': summary?.color ?? 'var(--category-other)' }">
    <RouterLink
      :to="{ name: ROUTE.home }"
      class="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-border-subtle bg-surface px-3 font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
    >
      <VIcon icon="lucide:chevron-left" class="size-4" />
      {{ $t('category.back') }}
    </RouterLink>

    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('category.failed')" />

    <template v-if="view && summary">
      <VCard padding="md" :class="{ 'opacity-60': state.status === 'loading' }">
        <CategorySummary :summary />
      </VCard>
      <p v-if="none" class="text-foreground-muted">{{ none }}</p>
      <!-- Side by side from the container's @3xl (the content column is at most 52rem), stacked below it; a row's cards share its height. -->
      <div class="grid gap-4" :class="{ '@3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]': people.length > 1 }">
        <VCard v-if="months" padding="md" class="min-w-0"><MonthsChart :months /></VCard>
        <VCard v-if="people.length > 1" padding="md" class="min-w-0"><WhoSpent :people /></VCard>
      </div>
      <div v-if="view.lines.length > 0" class="grid gap-4 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VCard padding="md" class="min-w-0"><MerchantList :merchants :more="moreMerchants" @pick="pickMerchant" /></VCard>
        <VCard v-if="when" padding="md" class="min-w-0"><WhenCharts :when /></VCard>
      </div>
      <VCard v-if="view.lines.length > 0" padding="md">
        <TransactionList v-model:query="query" v-model:sort="sort" :rows :total :merchant-name="merchantName" @clear="merchant = null" />
      </VCard>
      <p class="text-sm text-foreground-muted">{{ $t('category.footnote') }}</p>
    </template>
  </div>
</template>

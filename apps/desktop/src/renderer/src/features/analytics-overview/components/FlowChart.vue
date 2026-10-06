<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { VChart } from '@/shared/ui';
import { flowChartOption, flowList } from '../utils.ts';

const { view, fmt } = defineProps<{ view: AnalyticsOverview; fmt: MoneyFormat }>();
const option = computed(() => flowChartOption(view, fmt));
const list = computed(() => flowList(view, fmt));
const days = computed(() => view.unit === 'day');
</script>

<template>
  <section class="flex h-full flex-col gap-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold">{{ $t('analytics.flow.title') }}</h2>
        <p class="text-sm text-foreground-muted">{{ days ? $t('analytics.flow.days') : $t('analytics.flow.months') }}</p>
      </div>
      <div class="flex flex-wrap gap-4 text-sm text-foreground-secondary" aria-hidden="true">
        <span class="inline-flex items-center gap-1.5"><span class="h-0.75 w-4 rounded-full bg-success" />{{ $t('analytics.flow.income') }}</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-0.75 w-4 rounded-full bg-primary" />{{ $t('analytics.flow.spending') }}</span>
        <span v-if="days && view.usual" class="inline-flex items-center gap-1.5">
          <span class="w-4 border-t-2 border-dashed border-foreground-muted" />{{ $t('analytics.flow.usual') }}
        </span>
      </div>
    </div>
    <div class="h-72 grow"><VChart :option /></div>
    <ul class="sr-only">
      <li v-for="r in list" :key="r.key">{{ r.text }}</li>
    </ul>
  </section>
</template>

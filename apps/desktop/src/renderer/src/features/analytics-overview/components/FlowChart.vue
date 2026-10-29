<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsOverview } from '@contract/api.ts';
import { bankOf } from '@/entities/bank';
import type { MoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { t } from '@/shared/lib';
import { VChart, VSegmentedControl } from '@/shared/ui';
import { useFlowSplit } from '../composables/useFlowSplit.ts';
import type { FlowBank, FlowSplit } from '../types.ts';
import { flowChartOption, flowList } from '../utils.ts';

const { view, fmt } = defineProps<{ view: AnalyticsOverview; fmt: MoneyFormat }>();
const participant = useParticipantStore();
const { split, setSplit } = useFlowSplit();
// «By banks» is offered while two or more banks are on; otherwise the chart is drawn together (spec desktop-spending-split).
const offered = computed(() => participant.shown.length > 1);
const banks = computed<FlowBank[] | null>(() =>
  offered.value && split.value === 'banks'
    ? view.spendingByBank.map((b) => {
        const bank = bankOf(b.provider);
        return { provider: b.provider, name: bank.name, color: bank.color };
      })
    : null,
);
const splits = computed(() => [
  { value: 'together' as FlowSplit, label: t('analytics.flow.together') },
  { value: 'banks' as FlowSplit, label: t('analytics.flow.byBanks') },
]);
const option = computed(() => flowChartOption(view, fmt, banks.value));
const list = computed(() => flowList(view, fmt, banks.value));
const days = computed(() => view.unit === 'day');
</script>

<template>
  <section class="flex h-full flex-col gap-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold">{{ $t('analytics.flow.title') }}</h2>
        <p class="text-sm text-foreground-muted">{{ days ? $t('analytics.flow.days') : $t('analytics.flow.months') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex flex-wrap gap-4 text-sm text-foreground-secondary" aria-hidden="true">
          <span class="inline-flex items-center gap-1.5"><span class="h-0.75 w-4 rounded-full bg-success" />{{ $t('analytics.flow.income') }}</span>
          <template v-if="banks">
            <span v-for="b in banks" :key="b.provider" class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-4 rounded-sm" :style="{ background: b.color }" />{{ b.name }}
            </span>
          </template>
          <span v-else class="inline-flex items-center gap-1.5"><span class="h-0.75 w-4 rounded-full bg-primary" />{{ $t('analytics.flow.spending') }}</span>
          <span v-if="days && view.usual" class="inline-flex items-center gap-1.5">
            <span class="w-4 border-t-2 border-dashed border-foreground-muted" />{{ $t('analytics.flow.usual') }}
          </span>
        </div>
        <VSegmentedControl
          v-if="offered"
          :model-value="split"
          :options="splits"
          size="sm"
          role="group"
          :aria-label="$t('analytics.flow.splitLabel')"
          @update:model-value="setSplit"
        />
      </div>
    </div>
    <div class="h-72 grow"><VChart :option /></div>
    <ul class="sr-only">
      <li v-for="r in list" :key="r.key">{{ r.text }}</li>
    </ul>
  </section>
</template>

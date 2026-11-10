<script setup lang="ts">
import { computed } from 'vue';
import type { Quarter } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { VDatepicker, VMonthPicker, VSegmentedControl, VSelect, type SegmentOption, type VSelectOption } from '@/shared/ui';
import { PERIOD_KINDS } from '../constants.ts';
import type { PeriodKind, PeriodPick } from '../types.ts';

const { years, allowed, today } = defineProps<{
  years: ReadonlyArray<number>;
  /** Quarters after today's are not offered. */
  allowed: (q: Quarter) => boolean;
  /** YYYY-MM-DD: nothing after it is offered. */
  today: string;
}>();
const period = defineModel<PeriodPick>({ required: true });

const QUARTERS: ReadonlyArray<Quarter> = [1, 2, 3, 4];
const kindOptions = computed<SegmentOption<PeriodKind>[]>(() => PERIOD_KINDS.map((k) => ({ label: t(`fopTax.kind.${k}`), value: k })));
const yearOptions = computed<VSelectOption[]>(() => years.map((y) => ({ label: String(y), value: y })));
const quarterOptions = computed<SegmentOption<Quarter>[]>(() =>
  QUARTERS.map((q) => ({ label: t('fopTax.quarterShort', { n: q }), value: q, disabled: !allowed(q) })),
);
const kind = computed({ get: () => period.value.kind, set: (k: PeriodKind) => (period.value.kind = k) });
const year = computed<string | number | null>({
  get: () => period.value.year,
  set: (v) => {
    if (typeof v === 'number') period.value.year = v;
  },
});
const quarter = computed({ get: () => period.value.quarter, set: (q: Quarter) => (period.value.quarter = q) });
const month = computed({ get: () => period.value.month, set: (m: string) => (period.value.month = m) });
// A cleared date keeps the last one: the period always has both ends.
const from = computed<string | null>({
  get: () => period.value.from,
  set: (d) => {
    if (d) period.value.from = d;
  },
});
const to = computed<string | null>({
  get: () => period.value.to,
  set: (d) => {
    if (d) period.value.to = d;
  },
});
const firstMonth = computed(() => `${years[years.length - 1]}-01`);
const firstDay = computed(() => `${years[years.length - 1]}-01-01`);
</script>

<template>
  <div class="flex flex-col gap-3" data-test="period-picker">
    <VSegmentedControl v-model="kind" :options="kindOptions" :aria-label="$t('fopTax.period')" data-test="period-kind" />
    <div class="flex flex-wrap items-end gap-3">
      <VMonthPicker v-if="kind === 'month'" v-model="month" :min="firstMonth" :max="today.slice(0, 7)" :label="$t('fopTax.kind.month')" data-test="period-month" />
      <VSelect v-if="kind === 'quarter' || kind === 'year'" v-model="year" :options="yearOptions" :label="$t('fopTax.year')" class="w-28" data-test="period-year" />
      <div v-if="kind === 'quarter'" class="flex flex-col gap-1" data-test="quarter-picker">
        <span class="text-xs text-foreground-muted" aria-hidden="true">{{ $t('fopTax.quarter') }}</span>
        <VSegmentedControl v-model="quarter" :options="quarterOptions" :aria-label="$t('fopTax.quarter')" />
      </div>
      <template v-if="kind === 'dates'">
        <VDatepicker v-model="from" :label="$t('fopTax.from')" :min="firstDay" :max="today" class="w-48" data-test="period-from" />
        <VDatepicker v-model="to" :label="$t('fopTax.to')" :min="period.from" :max="today" class="w-48" data-test="period-to" />
      </template>
    </div>
  </div>
</template>

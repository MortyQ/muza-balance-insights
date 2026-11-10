<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/shared/lib';
import { VInput, VSegmentedControl, type SegmentOption } from '@/shared/ui';
import { FOP_RATES } from '../constants.ts';
import type { BaseChoice, RateChoice } from '../types.ts';
import { percentText } from '../utils.ts';

const { percentError, amountError } = defineProps<{ percentError: boolean; amountError: boolean }>();
const rate = defineModel<RateChoice>('rate', { required: true });
const percent = defineModel<string>('percent', { required: true });
const base = defineModel<BaseChoice>('base', { required: true });
const amount = defineModel<string>('amount', { required: true });

const rateOptions = computed<SegmentOption<RateChoice>[]>(() => [
  ...FOP_RATES.map((r) => ({ label: percentText(r), value: r })),
  { label: t('fopTax.custom'), value: 'custom' as const },
]);
const baseOptions = computed<SegmentOption<BaseChoice>[]>(() => [
  { label: t('fopTax.baseIncome'), value: 'income' },
  { label: t('fopTax.baseCustom'), value: 'custom' },
]);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-xs text-foreground-muted" aria-hidden="true">{{ $t('fopTax.rate') }}</span>
        <VSegmentedControl v-model="rate" :options="rateOptions" :aria-label="$t('fopTax.rate')" data-test="rate" />
      </div>
      <div v-if="rate === 'custom'" class="w-36" data-test="custom-percent">
        <VInput v-model="percent" :label="$t('fopTax.percent')" :show-clear-button="false" :error="percentError ? $t('fopTax.percentInvalid') : undefined" />
      </div>
    </div>
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-xs text-foreground-muted" aria-hidden="true">{{ $t('fopTax.base') }}</span>
        <VSegmentedControl v-model="base" :options="baseOptions" :aria-label="$t('fopTax.base')" data-test="base" />
      </div>
      <div v-if="base === 'custom'" class="w-44" data-test="custom-amount">
        <VInput v-model="amount" :label="$t('fopTax.amount')" :show-clear-button="false" :error="amountError ? $t('fopTax.amountInvalid') : undefined" />
      </div>
    </div>
  </div>
</template>

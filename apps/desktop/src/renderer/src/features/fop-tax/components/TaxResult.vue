<script setup lang="ts">
import { MoneyStack } from '@/entities/currency-display';
import type { FopTaxView } from '../types.ts';

const { view } = defineProps<{ view: FopTaxView }>();
</script>

<template>
  <div class="flex flex-col gap-3" data-test="tax-result">
    <div v-for="row in view.rows" :key="row.label" class="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-sunken px-4 py-3" data-test="tax-row">
      <div class="flex flex-col gap-1">
        <span class="text-xs text-foreground-muted">{{ row.label }}</span>
        <MoneyStack :amount="row.base" :also="row.baseAlso" align="start" :strong="false" />
      </div>
      <div class="flex flex-col items-end gap-1">
        <span class="text-xs text-foreground-muted">{{ $t('fopTax.tax') }} · {{ view.rateText }}</span>
        <MoneyStack :amount="row.tax" :also="row.taxAlso" :strong="false"><span class="text-2xl font-bold" data-test="tax-amount">{{ row.tax }}</span></MoneyStack>
      </div>
    </div>
    <p v-if="view.running" class="text-xs text-foreground-muted">{{ $t('fopTax.running') }}</p>
    <p v-if="view.leftOut" class="text-xs text-foreground-muted">{{ view.leftOut }}</p>
  </div>
</template>

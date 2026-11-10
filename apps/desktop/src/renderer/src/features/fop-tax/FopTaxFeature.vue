<script setup lang="ts">
import { VCard } from '@/shared/ui';
import PeriodPicker from './components/PeriodPicker.vue';
import RatePicker from './components/RatePicker.vue';
import TaxResult from './components/TaxResult.vue';
import { useFopTax } from './composables/useFopTax.ts';

const { period, rate, percentText, base, businessOffered, amountText, today, years, quarterAllowed, presetShown, percentError, amountError, view } = useFopTax();
</script>

<template>
  <VCard as="section" padding="none" :aria-label="$t('fopTax.title')" data-test="fop-tax">
    <div class="flex flex-col gap-5 px-4 py-4">
      <p class="text-sm text-foreground-secondary">{{ $t('fopTax.intro') }}</p>
      <RatePicker
        v-model:rate="rate"
        v-model:percent="percentText"
        v-model:base="base"
        v-model:amount="amountText"
        :percent-error
        :amount-error
        :business-offered
        :preset-shown
      />
      <!-- A typed amount has no period. -->
      <PeriodPicker v-if="base !== 'custom'" v-model="period" :years :allowed="quarterAllowed" :today />
      <TaxResult :view />
    </div>
    <!-- Always under the figures: an estimate, the single social contribution left out. -->
    <div class="flex flex-col gap-1 border-t border-border-subtle px-4 pt-3 pb-4" data-test="fop-notes">
      <p class="text-xs text-foreground-muted">{{ $t('fopTax.excluded') }}</p>
      <p class="text-xs font-semibold text-foreground-secondary" data-test="fop-esv">{{ $t('fopTax.esv') }}</p>
      <p class="text-xs text-foreground-secondary" data-test="fop-disclaimer">{{ $t('fopTax.disclaimer') }}</p>
    </div>
  </VCard>
</template>

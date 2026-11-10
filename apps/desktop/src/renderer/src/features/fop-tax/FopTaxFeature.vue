<script setup lang="ts">
import { VCard, VInfoNotice } from '@/shared/ui';
import QuarterPicker from './components/QuarterPicker.vue';
import RatePicker from './components/RatePicker.vue';
import TaxResult from './components/TaxResult.vue';
import { useFopTax } from './composables/useFopTax.ts';

const { state, year, quarter, rate, percentText, base, amountText, years, quarterAllowed, percentError, amountError, view } = useFopTax();
</script>

<template>
  <VCard as="section" padding="none" :aria-label="$t('fopTax.title')" data-test="fop-tax">
    <div class="flex flex-col gap-4 px-4 py-4">
      <p class="text-sm text-foreground-secondary">{{ $t('fopTax.intro') }}</p>
      <VInfoNotice
        v-if="state.data && !state.data.available"
        :card="false"
        icon="lucide:info"
        tone="muted"
        :subtitle="$t('fopTax.unavailable')"
        data-test="fop-unavailable"
      />
      <template v-else>
        <QuarterPicker v-model:year="year" v-model:quarter="quarter" :years :allowed="quarterAllowed" />
        <RatePicker v-model:rate="rate" v-model:percent="percentText" v-model:base="base" v-model:amount="amountText" :percent-error :amount-error />
        <TaxResult v-if="view" :view />
      </template>
    </div>
    <!-- Always under the figures: an estimate, the single social contribution left out. -->
    <div class="flex flex-col gap-1 border-t border-border-subtle px-4 pt-3 pb-4" data-test="fop-notes">
      <p class="text-xs text-foreground-muted">{{ $t('fopTax.excluded') }}</p>
      <p class="text-xs font-semibold text-foreground-secondary" data-test="fop-esv">{{ $t('fopTax.esv') }}</p>
      <p class="text-xs text-foreground-secondary" data-test="fop-disclaimer">{{ $t('fopTax.disclaimer') }}</p>
    </div>
  </VCard>
</template>

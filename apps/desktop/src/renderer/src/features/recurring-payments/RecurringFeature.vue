<script setup lang="ts">
import { VCard, VInfoNotice } from '@/shared/ui';
import RecurringList from './components/RecurringList.vue';
import RecurringSummary from './components/RecurringSummary.vue';
import { useRecurring } from './composables/useRecurring.ts';
import { useRecurringView } from './composables/useRecurringView.ts';

const { state, view, fmt } = useRecurring();
const { summary, active, ended } = useRecurringView({ view, fmt });
</script>

<template>
  <div class="flex flex-col gap-4">
    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('recurring.failed')" />
    <template v-if="summary">
      <VCard padding="md" :class="{ 'opacity-60': state.status === 'loading' }">
        <RecurringSummary :summary />
      </VCard>
      <VCard v-if="active.length > 0" padding="md"><RecurringList :rows="active" /></VCard>
      <p v-else class="text-foreground-muted">{{ $t('recurring.empty') }}</p>
      <VCard v-if="ended.length > 0" padding="md"><RecurringList :rows="ended" :title="$t('recurring.ended')" /></VCard>
      <p class="text-sm text-foreground-muted">{{ $t('recurring.footnote') }}</p>
    </template>
  </div>
</template>

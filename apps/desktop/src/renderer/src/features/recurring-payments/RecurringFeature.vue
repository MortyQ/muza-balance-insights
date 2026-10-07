<script setup lang="ts">
import { VCard, VInfoNotice } from '@/shared/ui';
import RecurringList from './components/RecurringList.vue';
import RecurringSummary from './components/RecurringSummary.vue';
import { useRecurring } from './composables/useRecurring.ts';
import { useRecurringView } from './composables/useRecurringView.ts';

const { state, view, fmt, setMark, markFailed } = useRecurring();
const { summary, active, ended, hidden } = useRecurringView({ view, fmt });
</script>

<template>
  <div class="flex flex-col gap-4">
    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('recurring.failed')" />
    <VInfoNotice v-if="markFailed" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('recurring.markFailed')" />
    <template v-if="summary">
      <VCard padding="md" :class="{ 'opacity-60': state.status === 'loading' }">
        <RecurringSummary :summary />
      </VCard>
      <VCard v-if="active.length > 0" padding="md"><RecurringList :rows="active" @mark="setMark" /></VCard>
      <p v-else class="text-foreground-muted">{{ $t('recurring.empty') }}</p>
      <VCard v-if="ended.length > 0" padding="md"><RecurringList :rows="ended" :title="$t('recurring.ended')" @mark="setMark" /></VCard>
      <!-- Hidden: folded away, each can come back. -->
      <VCard v-if="hidden.length > 0" padding="md">
        <details class="group">
          <summary class="cursor-pointer text-sm font-semibold text-foreground-secondary">{{ $t('recurring.hiddenTitle', { n: hidden.length }) }}</summary>
          <RecurringList class="mt-2" :rows="hidden" hidden @mark="setMark" />
        </details>
      </VCard>
      <p class="text-sm text-foreground-muted">{{ $t('recurring.footnote') }}</p>
    </template>
  </div>
</template>

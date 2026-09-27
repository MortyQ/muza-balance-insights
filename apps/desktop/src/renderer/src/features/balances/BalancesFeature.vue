<script setup lang="ts">
import { computed } from 'vue';
import { useSyncStatusStore } from '@/entities/sync-status';
import { formatMoney } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import { useBalances } from './composables/useBalances.ts';

// Temporary bridge onto getMonthOverview (task 2): shows only the family/person total. Rewritten in task 6.
const { state } = useBalances();
const syncStatus = useSyncStatusStore();
const view = computed(() => state.value.data);
const failed = computed(() => state.value.status === 'error');
</script>

<template>
  <VCard title="Балансы" padding="md">
    <div class="flex flex-col gap-4">
      <VInfoNotice v-if="failed" :card="false" icon="lucide:circle-alert" tone="danger" subtitle="Не удалось прочитать балансы." />
      <p v-else-if="!syncStatus.hasData" class="text-foreground-muted">Счетов пока нет: загрузи выписку в разделе «Импорт».</p>
      <p v-else-if="view" class="text-2xl font-semibold tabular-nums" :class="{ 'text-danger': view.total.ownFunds < 0 }">
        {{ formatMoney(view.total.ownFunds, 980, { minorUnits: true }) }}
      </p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CurrencyToggle } from '@/entities/currency-display';
import { useImportProgressStore } from '@/entities/import-progress';
import { ParticipantFilter, useParticipantStore } from '@/entities/participant';
import { firstMonthOf, MonthFilter } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import SyncStatus from './components/SyncStatus.vue';
import { failedConnections, syncStatusView } from './utils.ts';

const syncStatus = useSyncStatusStore();
const importProgress = useImportProgressStore();
const participant = useParticipantStore();
const firstMonth = computed(() => firstMonthOf(syncStatus.status?.dataFrom));
// The import and the people are two entities: they meet here, and the filter gets the result as a prop.
const status = computed(() =>
  syncStatusView(importProgress.progress, { line: syncStatus.line, lastSyncAt: syncStatus.status?.lastSyncAt ?? null }, Date.now(), participant.labelOf),
);
const failed = computed(() => failedConnections(importProgress.progress));
</script>

<template>
  <!-- The filters every home block reads (person, month); the app name and the settings button live in the window's
       title bar (widgets/app-header). Sticky: the filters stay at hand while the blocks scroll under them; above the
       balance block's header (z-40). -->
  <!-- No aria-busy here: it can hold back the status's live-region announcement. -->
  <header class="sticky top-0 z-50 -mx-8 flex flex-wrap items-center gap-3 border-b border-border-subtle bg-background px-8 py-2">
    <h1 class="sr-only">Balance Insights</h1>
    <template v-if="syncStatus.hasData">
      <ParticipantFilter :failed />
      <MonthFilter :min="firstMonth" />
      <CurrencyToggle />
    </template>
    <SyncStatus v-if="status.text" :view="status" />
  </header>
</template>

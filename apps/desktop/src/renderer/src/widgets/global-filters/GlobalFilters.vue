<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { CurrencyToggle } from '@/entities/currency-display';
import { useImportProgressStore } from '@/entities/import-progress';
import { ParticipantFilter, useParticipantStore } from '@/entities/participant';
import { firstMonthOf, MonthFilter } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import SyncStatus from './components/SyncStatus.vue';
import { useParticipantLayout } from './composables/useParticipantLayout.ts';
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
const { mode } = useParticipantLayout({
  row: useTemplateRef<HTMLElement>('row'),
  left: useTemplateRef<HTMLElement>('left'),
  right: useTemplateRef<HTMLElement>('right'),
  center: useTemplateRef<HTMLElement>('center'),
});
</script>

<template>
  <!-- No aria-busy here: it can hold back the status's live-region announcement. -->
  <header
    ref="row"
    class="relative grid items-center gap-3 border-b border-border-subtle py-2"
    :class="mode === 'buttons' ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_0_auto]'"
  >
    <!-- The filters every home block reads (person, month, currency); the app name and the settings button live in the
         window's title bar (widgets/app-header). Outside the home screen's scroll area: it stays put while the blocks
         scroll. The page sets its width (the grid's).
         Person: buttons centred in the row, or a select before the month (useParticipantLayout). -->
    <h1 class="sr-only">Balance Insights</h1>
    <div class="flex min-w-0 flex-wrap items-center gap-3">
      <template v-if="syncStatus.hasData">
        <ParticipantFilter v-if="mode === 'select'" mode="select" :failed />
        <div ref="left" class="flex items-center gap-3">
          <MonthFilter :min="firstMonth" />
          <CurrencyToggle />
        </div>
      </template>
    </div>
    <div class="flex justify-center">
      <ParticipantFilter v-if="syncStatus.hasData && mode === 'buttons'" :failed />
    </div>
    <div ref="right" class="justify-self-end whitespace-nowrap">
      <SyncStatus v-if="status.text" :view="status" />
    </div>
    <div ref="center" class="invisible absolute top-0 left-0 w-max" aria-hidden="true" inert>
      <ParticipantFilter v-if="syncStatus.hasData" :failed />
    </div>
  </header>
</template>

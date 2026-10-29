<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';
import { importFloor } from '@contract/import-range.ts';
import { CurrencyToggle } from '@/entities/currency-display';
import { useImportProgressStore } from '@/entities/import-progress';
import { ParticipantFilter, useParticipantStore } from '@/entities/participant';
import { MonthFilter, PeriodRangeFilter, useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { QuickUploadButtonFeature } from '@/features/integrations';
import { monthOf } from '@/shared/lib';
import BankFilter from './components/BankFilter.vue';
import FreshnessList from './components/FreshnessList.vue';
import SyncStatus from './components/SyncStatus.vue';
import { useParticipantLayout } from './composables/useParticipantLayout.ts';
import { failedConnections, freshnessRows, syncStatusView } from './utils.ts';

const syncStatus = useSyncStatusStore();
const importProgress = useImportProgressStore();
const participant = useParticipantStore();
const monthStore = useMonthStore();
// Back to the oldest month the import reaches, not just the first with data: an older month gets HomeNotices' «download».
const firstMonth = computed(() => monthOf(importFloor(monthStore.today)));
// The import and the people are two entities: they meet here, and the filter gets the result as a prop.
const status = computed(() =>
  syncStatusView(importProgress.progress, { line: syncStatus.line, lastSyncAt: syncStatus.status?.lastSyncAt ?? null }, Date.now(), participant.labelOf),
);
const failed = computed(() => failedConnections(importProgress.progress));
const freshness = computed(() => freshnessRows(participant.people, syncStatus.status?.dataUntil ?? null));
// Analytics picks whole months (a range or one), home one month, regular payments none: the route says which.
const route = useRoute();
const periodFilter = computed(() => route.meta.periodFilter ?? 'month');
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
    class="relative grid items-center gap-3 py-2"
    :class="mode === 'buttons' ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_0_auto]'"
  >
    <!-- The filters every home block reads (person, month, currency, banks); the app name and the settings button live in the
         window's title bar (widgets/app-header). Outside the home screen's scroll area: it stays put while the blocks
         scroll. The layout places it after the screen title (that is the page's h1) and draws the row's border.
         Person: buttons centred in the row, or a select before the month (useParticipantLayout). -->
    <div class="flex min-w-0 flex-wrap items-center gap-3">
      <template v-if="syncStatus.hasData">
        <ParticipantFilter v-if="mode === 'select'" mode="select" :failed />
        <div ref="left" class="flex items-center gap-3">
          <PeriodRangeFilter v-if="periodFilter === 'range'" :min="firstMonth" :data-from="syncStatus.status?.dataFrom ?? null" />
          <MonthFilter v-else-if="periodFilter === 'month'" :min="firstMonth" />
          <CurrencyToggle />
          <BankFilter />
        </div>
      </template>
    </div>
    <div class="flex justify-center">
      <ParticipantFilter v-if="syncStatus.hasData && mode === 'buttons'" :failed />
    </div>
    <div ref="right" class="flex items-center gap-3 justify-self-end whitespace-nowrap">
      <SyncStatus v-if="status.text" :view="status" />
      <FreshnessList v-if="freshness.length > 0" :rows="freshness" :today="monthStore.today" />
      <QuickUploadButtonFeature />
    </div>
    <div ref="center" class="invisible absolute top-0 left-0 w-max" aria-hidden="true" inert>
      <ParticipantFilter v-if="syncStatus.hasData" :failed />
    </div>
  </header>
</template>

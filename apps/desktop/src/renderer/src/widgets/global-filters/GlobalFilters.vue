<script setup lang="ts">
import { computed } from 'vue';
import { ParticipantFilter } from '@/entities/participant';
import { firstMonthOf, MonthFilter } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';

const syncStatus = useSyncStatusStore();
const firstMonth = computed(() => firstMonthOf(syncStatus.status?.dataFrom));
</script>

<template>
  <!-- The filters every home block reads (person, month); the app name and the settings button live in the window's
       title bar (widgets/app-header). Sticky: the filters stay at hand while the blocks scroll under them; above the
       balance block's header (z-40). -->
  <header class="sticky top-0 z-50 -mx-8 flex flex-wrap items-center gap-3 border-b border-border-subtle bg-background px-8 py-2">
    <h1 class="sr-only">Balance Insights</h1>
    <template v-if="syncStatus.hasData">
      <ParticipantFilter />
      <MonthFilter :min="firstMonth" />
    </template>
    <span v-if="syncStatus.line" class="ml-auto text-sm text-foreground-muted tabular-nums">{{ syncStatus.line }}</span>
  </header>
</template>

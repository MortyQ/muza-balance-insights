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
       title bar (widgets/app-header). -->
  <header class="flex flex-wrap items-center gap-3">
    <h1 class="sr-only">Balance Insights</h1>
    <template v-if="syncStatus.hasData">
      <ParticipantFilter />
      <MonthFilter :min="firstMonth" />
    </template>
    <span v-if="syncStatus.line" class="ml-auto text-sm text-foreground-muted tabular-nums">{{ syncStatus.line }}</span>
  </header>
</template>

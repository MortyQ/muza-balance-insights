<script setup lang="ts">
import { useSyncStatusStore } from '@/entities/sync-status';
import { ParticipantSwitchFeature } from '@/features/participant-switch';

const syncStatus = useSyncStatusStore();
</script>

<template>
  <!-- The app name and the settings button live in the window's title bar (widgets/app-header). -->
  <header class="flex flex-wrap items-center gap-3">
    <h1 class="sr-only">Balance Insights</h1>
    <ParticipantSwitchFeature v-if="syncStatus.hasData" />
    <span v-if="syncStatus.line" class="ml-auto text-sm text-foreground-muted tabular-nums">{{ syncStatus.line }}</span>
  </header>
</template>

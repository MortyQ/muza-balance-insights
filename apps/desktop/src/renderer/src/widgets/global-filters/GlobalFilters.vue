<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { ParticipantFilter } from '@/entities/participant';
import { firstMonthOf, MonthFilter } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useParticipantLayout } from './composables/useParticipantLayout.ts';

const syncStatus = useSyncStatusStore();
const firstMonth = computed(() => firstMonthOf(syncStatus.status?.dataFrom));
const { mode } = useParticipantLayout({
  row: useTemplateRef<HTMLElement>('row'),
  left: useTemplateRef<HTMLElement>('left'),
  right: useTemplateRef<HTMLElement>('right'),
  center: useTemplateRef<HTMLElement>('center'),
});
</script>

<template>
  <header
    ref="row"
    class="relative grid items-center gap-3 border-b border-border-subtle py-2"
    :class="mode === 'buttons' ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_0_auto]'"
  >
    <!-- The filters every home block reads (person, month); the app name and the settings button live in the window's
         title bar (widgets/app-header). Outside the home screen's scroll area: it stays put while the blocks scroll. The
         page sets its width (the grid's).
         Person: buttons centred in the row, or a select before the month (useParticipantLayout). -->
    <h1 class="sr-only">Balance Insights</h1>
    <div class="flex min-w-0 flex-wrap items-center gap-3">
      <template v-if="syncStatus.hasData">
        <ParticipantFilter v-if="mode === 'select'" mode="select" />
        <div ref="left">
          <MonthFilter :min="firstMonth" />
        </div>
      </template>
    </div>
    <div class="flex justify-center">
      <ParticipantFilter v-if="syncStatus.hasData && mode === 'buttons'" />
    </div>
    <span ref="right" class="justify-self-end text-sm whitespace-nowrap text-foreground-muted tabular-nums">{{ syncStatus.line }}</span>
    <div ref="center" class="invisible absolute top-0 left-0 w-max" aria-hidden="true" inert>
      <ParticipantFilter v-if="syncStatus.hasData" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue';
import { IMPORT_PRESETS, importFloor, isImportFrom, monthsBefore } from '@contract/import-range.ts';
import { MONOBANK } from '@/entities/bank';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { fullDate, t } from '@/shared/lib';
import { type SegmentOption, VButton, VDatepicker, VInfoNotice, VProgressBar, VSegmentedControl } from '@/shared/ui';
import { useImport } from './composables/useImport.ts';
import { autoLine, failureLines, presetOf, progressLine, windowsPercent } from './utils.ts';

const { requestedFrom = null, focus = false } = defineProps<{
  /** A start date asked for by the link that opened the section (home's «no data» notices); ignored when out of range. */
  requestedFrom?: string | null;
  /** Scroll the section into view and focus it on open. */
  focus?: boolean;
}>();

const importProgress = useImportProgressStore();
const participant = useParticipantStore();
const monthStore = useMonthStore();
const today = computed(() => monthStore.today);
const { from, valid, error, start, cancel } = useImport(today);

// An automatic refresh does not hold the controls: «Download» replaces it with the user's import.
const userRunning = computed(() => importProgress.running && !importProgress.auto);
const line = computed(() => (importProgress.auto ? autoLine : progressLine)(importProgress.progress, Date.now()));
const percent = computed(() => (importProgress.auto ? null : windowsPercent(importProgress.progress)));
const failures = computed(() => failureLines(importProgress.progress, participant.labelOf));

const presetOptions = computed<SegmentOption<number>[]>(() => IMPORT_PRESETS.map((n) => ({ label: t('home.import.depthMonths', { n }), value: n })));
// 0 = a date picked in the calendar: no quick pick is highlighted.
const preset = computed<number>({
  get: () => presetOf(from.value, today.value),
  set: (n) => {
    if (n) from.value = monthsBefore(today.value, n);
  },
});
// The calendar's own bounds keep it in range; a date typed past them, or a cleared field, keeps the last good one.
const picked = computed<string | null>({
  get: () => from.value,
  set: (v) => {
    if (v && isImportFrom(v, today.value)) from.value = v;
  },
});

watch(
  () => requestedFrom,
  (v) => {
    if (v && isImportFrom(v, today.value)) from.value = v;
  },
  { immediate: true },
);

const root = useTemplateRef<HTMLElement>('root');
onMounted(() => {
  if (!focus) return;
  root.value?.scrollIntoView?.({ block: 'start' });
  root.value?.focus({ preventScroll: true });
});
</script>

<template>
  <div ref="root" tabindex="-1" class="scroll-mt-6 outline-none">
    <!-- Focusable so a link from home lands here (focus). -->
    <SettingsSection :title="$t('home.import.title')" :description="$t('home.import.description')" :note="$t('home.import.about')">
      <!-- The import is Monobank's for now: one list per bank once there are more. -->
      <SettingsList :heading="$t(MONOBANK.name)">
        <div class="flex flex-col gap-3 px-4 py-3">
          <span class="font-semibold">{{ $t('home.import.period') }}</span>
          <VSegmentedControl v-model="preset" :options="presetOptions" :disabled="userRunning" full-width />
          <div class="flex flex-wrap items-end gap-3">
            <VDatepicker v-model="picked" :label="$t('home.import.fromDate')" :min="importFloor(today)" :max="today" :disabled="userRunning" class="w-56" />
            <p class="pb-2 text-sm text-foreground-muted">{{ $t('home.import.untilToday', { date: fullDate(from) }) }}</p>
          </div>
        </div>
        <div class="flex flex-col gap-3 px-4 py-3">
          <div class="flex flex-wrap items-center gap-3">
            <VButton
              v-if="!userRunning"
              :text="$t('home.import.start')"
              icon="lucide:download"
              :disabled="!participant.anyToken || !valid"
              @click="start"
            />
            <VButton v-else variant="neutral" :text="$t('home.import.stop')" icon="lucide:square" @click="cancel" />
          </div>
          <VProgressBar v-if="percent !== null" :percentage="percent" size="sm" />
          <p v-if="line" class="text-foreground-secondary tabular-nums">{{ line }}</p>
          <VInfoNotice
            v-for="f in failures"
            :key="f"
            :card="false"
            icon="lucide:triangle-alert"
            tone="warning"
            :subtitle="$t('home.import.notLoaded', { line: f })"
          />
          <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
        </div>
      </SettingsList>
    </SettingsSection>
  </div>
</template>

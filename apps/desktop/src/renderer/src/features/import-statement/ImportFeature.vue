<script setup lang="ts">
import { computed } from 'vue';
import { IMPORT_DEPTHS } from '@contract/progress.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { t } from '@/shared/lib';
import { VButton, VCard, VInfoNotice, VProgressBar, VSelect, type VSelectOption } from '@/shared/ui';
import { useImport } from './composables/useImport.ts';
import { autoLine, failureLines, progressLine, windowsPercent } from './utils.ts';

const importProgress = useImportProgressStore();
const participant = useParticipantStore();
const { depth, error, start, cancel } = useImport();

// An automatic refresh does not hold the controls: «Download» replaces it with the user's import.
const userRunning = computed(() => importProgress.running && !importProgress.auto);
const line = computed(() => (importProgress.auto ? autoLine : progressLine)(importProgress.progress, Date.now()));
const percent = computed(() => (importProgress.auto ? null : windowsPercent(importProgress.progress)));
const failures = computed(() => failureLines(importProgress.progress, participant.labelOf));
const depthOptions = computed<VSelectOption[]>(() => IMPORT_DEPTHS.map((d) => ({ label: t('home.import.depthMonths', { n: d }), value: d })));
</script>

<template>
  <VCard :title="$t('home.import.title')" padding="md">
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <VSelect v-model="depth" :label="$t('home.import.depth')" :options="depthOptions" :disabled="userRunning" class="w-32" />
        <VButton v-if="!userRunning" :text="$t('home.import.start')" icon="lucide:download" :disabled="!participant.anyToken" @click="start" />
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
      <p class="text-sm text-foreground-muted">
        {{ $t('home.import.about') }}
      </p>
    </div>
  </VCard>
</template>

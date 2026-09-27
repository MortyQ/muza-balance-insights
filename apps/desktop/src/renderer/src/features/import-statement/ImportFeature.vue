<script setup lang="ts">
import { computed } from 'vue';
import { IMPORT_DEPTHS } from '@contract/progress.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VCard, VInfoNotice, VProgressBar, VSelect, type VSelectOption } from '@/shared/ui';
import { useImport } from './composables/useImport.ts';
import { autoLine, failureLines, progressLine, windowsPercent } from './utils.ts';

const importProgress = useImportProgressStore();
const participant = useParticipantStore();
const { depth, error, start, cancel } = useImport();

// An automatic refresh does not hold the controls: «Загрузить» replaces it with the user's import.
const userRunning = computed(() => importProgress.running && !importProgress.auto);
const line = computed(() => (importProgress.auto ? autoLine : progressLine)(importProgress.progress, Date.now()));
const percent = computed(() => (importProgress.auto ? null : windowsPercent(importProgress.progress)));
const failures = computed(() => failureLines(importProgress.progress, participant.labelOf));
const depthOptions = computed<VSelectOption[]>(() => IMPORT_DEPTHS.map((d) => ({ label: `${d} мес.`, value: d })));
</script>

<template>
  <VCard title="Импорт" padding="md">
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <VSelect v-model="depth" label="Глубина" :options="depthOptions" :disabled="userRunning" class="w-32" />
        <VButton v-if="!userRunning" text="Загрузить" icon="lucide:download" :disabled="!participant.anyToken" @click="start" />
        <VButton v-else variant="neutral" text="Остановить" icon="lucide:square" @click="cancel" />
      </div>
      <VProgressBar v-if="percent !== null" :percentage="percent" size="sm" />
      <p v-if="line" class="text-foreground-secondary tabular-nums">{{ line }}</p>
      <VInfoNotice
        v-for="f in failures"
        :key="f"
        :card="false"
        icon="lucide:triangle-alert"
        tone="warning"
        :subtitle="`Не загружено — ${f}`"
      />
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
      <p class="text-sm text-foreground-muted">
        Загружаются все подключения. Monobank отдаёт выписку не чаще раза в минуту на токен и не больше 31 дня за запрос: примерно
        минута на каждый месяц истории каждого счёта, подключения разных людей идут параллельно. Сначала загружается текущий месяц
        по всем счетам, потом история. Импорт можно остановить и продолжить позже. Новые операции подгружаются и сами — см.
        «Автосинхронизация» в настройках.
      </p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IMPORT_DEPTHS } from '@contract/progress.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { useTokenStore } from '@/entities/token';
import { VButton, VCard, VInfoNotice, VProgressBar } from '@/shared/ui';
import { useImport } from './composables/useImport.ts';
import { progressLine, windowsPercent } from './utils.ts';

const importProgress = useImportProgressStore();
const token = useTokenStore();
const { depth, error, start, cancel } = useImport();

const line = computed(() => progressLine(importProgress.progress, Date.now()));
const percent = computed(() => windowsPercent(importProgress.progress));
</script>

<template>
  <VCard title="Импорт" padding="md">
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2">
          Глубина:
          <select
            v-model.number="depth"
            class="h-(--control-h) rounded-md border border-input-border bg-input-bg px-2 disabled:text-foreground-disabled"
            :disabled="importProgress.running"
          >
            <option v-for="d in IMPORT_DEPTHS" :key="d" :value="d">{{ d }} мес.</option>
          </select>
        </label>
        <VButton v-if="!importProgress.running" text="Загрузить" icon="lucide:download" :disabled="!token.connected" @click="start" />
        <VButton v-else variant="neutral" text="Остановить" icon="lucide:square" @click="cancel" />
      </div>
      <VProgressBar v-if="percent !== null" :percentage="percent" size="sm" />
      <p v-if="line" class="text-foreground-secondary tabular-nums">{{ line }}</p>
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
      <p class="text-sm text-foreground-muted">
        Monobank отдаёт выписку не чаще раза в минуту и не больше 31 дня за запрос: примерно минута на каждый месяц истории каждого
        счёта. Сначала загружается текущий месяц по всем счетам, потом история. Импорт можно остановить и продолжить позже.
      </p>
    </div>
  </VCard>
</template>

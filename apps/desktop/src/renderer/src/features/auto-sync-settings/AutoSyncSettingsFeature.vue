<script setup lang="ts">
import { AUTO_SYNC_TRIGGERS, type AutoSyncTrigger } from '@contract/auto-sync.ts';
import { VCard, VInfoNotice, VSwitch } from '@/shared/ui';
import { useAutoSyncSettings } from './composables/useAutoSyncSettings.ts';
import { TRIGGER_LABELS } from './constants.ts';
import { isChecked } from './utils.ts';

const { settings, busy, error, setEnabled, setTrigger } = useAutoSyncSettings();

// The switch's hidden input is flipped by the browser before @change fires; on failure `settings` stays as it was,
// so the input is put back by hand.
async function onEnabled(e: Event): Promise<void> {
  const checked = isChecked(e);
  await setEnabled(checked);
  if (error.value && e.target instanceof HTMLInputElement) e.target.checked = settings.value?.enabled ?? !checked;
}

async function onTrigger(trigger: AutoSyncTrigger, e: Event): Promise<void> {
  const checked = isChecked(e);
  await setTrigger(trigger, checked);
  if (error.value && e.target instanceof HTMLInputElement) e.target.checked = settings.value?.triggers[trigger] ?? !checked;
}
</script>

<template>
  <VCard title="Автообновление" padding="md">
    <div class="flex flex-col gap-4">
      <p class="text-sm text-foreground-muted">
        Приложение само подгружает новые операции всех подключений и заново читает последний 31 день: так подтягиваются холды,
        которые с тех пор завершились или отменились. Не чаще раза в 30 минут. Историю глубже загружает кнопка «Загрузить» на главной.
      </p>
      <template v-if="settings">
        <VSwitch :model-value="settings.enabled" :disabled="busy" @change="onEnabled($event)">Обновлять данные автоматически</VSwitch>
        <fieldset v-if="settings.enabled" class="flex flex-col gap-2">
          <legend class="mb-1 font-semibold">Когда обновлять</legend>
          <VSwitch v-for="t in AUTO_SYNC_TRIGGERS" :key="t" :model-value="settings.triggers[t]" :disabled="busy" @change="onTrigger(t, $event)">
            {{ TRIGGER_LABELS[t] }}
          </VSwitch>
        </fieldset>
      </template>
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </div>
  </VCard>
</template>

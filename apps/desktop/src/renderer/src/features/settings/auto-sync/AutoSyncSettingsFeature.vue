<script setup lang="ts">
import { useId } from 'vue';
import { AUTO_SYNC_TRIGGERS, type AutoSyncTrigger } from '@contract/auto-sync.ts';
import { VInfoNotice, VSwitch } from '@/shared/ui';
import { useAutoSyncSettings } from './composables/useAutoSyncSettings.ts';
import { TRIGGER_LABELS } from './constants.ts';
import SettingsList from '../shared/components/SettingsList.vue';
import SettingsRow from '../shared/components/SettingsRow.vue';
import SettingsSection from '../shared/components/SettingsSection.vue';
import { isChecked, restoreSwitch } from '../shared/utils.ts';

const id = useId();
const { settings, busy, error, setEnabled, setTrigger } = useAutoSyncSettings();

async function onEnabled(e: Event): Promise<void> {
  const checked = isChecked(e);
  await setEnabled(checked);
  if (error.value) restoreSwitch(e, settings.value?.enabled ?? !checked);
}

async function onTrigger(trigger: AutoSyncTrigger, e: Event): Promise<void> {
  const checked = isChecked(e);
  await setTrigger(trigger, checked);
  if (error.value) restoreSwitch(e, settings.value?.triggers[trigger] ?? !checked);
}
</script>

<template>
  <SettingsSection
    title="Автообновление"
    description="Приложение само подгружает новые операции всех подключений и заново читает последний 31 день: так подтягиваются холды, которые с тех пор завершились или отменились."
    note="Не чаще раза в 30 минут. Историю глубже загружает кнопка «Загрузить» на главной."
  >
    <template v-if="settings">
      <SettingsList>
        <SettingsRow title="Обновлять данные автоматически" hint="Вся семья: подключения с сохранённым токеном." :label-for="`${id}-enabled`">
          <VSwitch :id="`${id}-enabled`" :model-value="settings.enabled" :disabled="busy" role="switch" @change="onEnabled($event)" />
        </SettingsRow>
      </SettingsList>
      <SettingsList v-if="settings.enabled" heading="Когда обновлять">
        <SettingsRow v-for="t in AUTO_SYNC_TRIGGERS" :key="t" :title="TRIGGER_LABELS[t]" :label-for="`${id}-${t}`">
          <VSwitch
            :id="`${id}-${t}`"
            :model-value="settings.triggers[t]"
            :disabled="busy"
            role="switch"
            @change="onTrigger(t, $event)"
          />
        </SettingsRow>
      </SettingsList>
    </template>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>

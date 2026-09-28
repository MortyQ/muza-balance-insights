<script setup lang="ts">
import { useId } from 'vue';
import { AUTO_SYNC_TRIGGERS, type AutoSyncTrigger } from '@contract/auto-sync.ts';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { VInfoNotice, VSwitch } from '@/shared/ui';
import { useAutoSyncSettings } from './composables/useAutoSyncSettings.ts';
import { TRIGGER_LABELS } from './constants.ts';
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
    :title="$t('settings.autoSync.title')"
    :description="$t('settings.autoSync.description')"
    :note="$t('settings.autoSync.note')"
  >
    <template v-if="settings">
      <SettingsList>
        <SettingsRow :title="$t('settings.autoSync.enabled')" :hint="$t('settings.autoSync.enabledHint')" :label-for="`${id}-enabled`">
          <VSwitch :id="`${id}-enabled`" :model-value="settings.enabled" :disabled="busy" role="switch" @change="onEnabled($event)" />
        </SettingsRow>
      </SettingsList>
      <SettingsList v-if="settings.enabled" :heading="$t('settings.autoSync.when')">
        <SettingsRow v-for="tr in AUTO_SYNC_TRIGGERS" :key="tr" :title="$t(TRIGGER_LABELS[tr])" :label-for="`${id}-${tr}`">
          <VSwitch
            :id="`${id}-${tr}`"
            :model-value="settings.triggers[tr]"
            :disabled="busy"
            role="switch"
            @change="onTrigger(tr, $event)"
          />
        </SettingsRow>
      </SettingsList>
    </template>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>

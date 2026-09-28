<script setup lang="ts">
import { useId } from 'vue';
import { LOCK_TRIGGERS, type LockTrigger } from '@contract/lock.ts';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { VButton, VInfoNotice, VSwitch } from '@/shared/ui';
import PinField from './components/PinField.vue';
import { useLockSettings } from './composables/useLockSettings.ts';
import { SUBMIT_TEXT, TRIGGER_LABELS } from './constants.ts';
import { isChecked, restoreSwitch } from '../shared/utils.ts';

const id = useId();
const { view, mode, current, next, repeat, busy, error, open, submit, disableWithTouchId, setTrigger, setTouchId, lockNow } = useLockSettings();

async function onTrigger(trigger: LockTrigger, e: Event): Promise<void> {
  const checked = isChecked(e);
  await setTrigger(trigger, checked);
  if (error.value) restoreSwitch(e, view.value?.triggers[trigger] ?? !checked);
}

async function onTouchId(e: Event): Promise<void> {
  const checked = isChecked(e);
  await setTouchId(checked);
  if (error.value) restoreSwitch(e, view.value?.touchId ?? !checked);
}
</script>

<template>
  <SettingsSection
    :title="$t('settings.lock.title')"
    :description="$t('settings.lock.description')"
    :note="$t('settings.lock.note')"
  >
    <template v-if="view">
      <SettingsList v-if="!view.enabled && mode === 'idle'">
        <SettingsRow :title="$t('settings.lock.off')" :hint="$t('settings.lock.offHint')">
          <VButton :text="$t('settings.lock.enable')" icon="lucide:lock" @click="open('enable')" />
        </SettingsRow>
      </SettingsList>

      <template v-if="view.enabled && mode === 'idle'">
        <SettingsList :heading="$t('settings.lock.when')">
          <SettingsRow v-for="tr in LOCK_TRIGGERS" :key="tr" :title="$t(TRIGGER_LABELS[tr])" :label-for="`${id}-${tr}`">
            <VSwitch
              :id="`${id}-${tr}`"
              :model-value="view.triggers[tr]"
              :disabled="busy"
              role="switch"
              @change="onTrigger(tr, $event)"
            />
          </SettingsRow>
        </SettingsList>
        <SettingsList v-if="view.touchIdAvailable">
          <SettingsRow :title="$t('settings.lock.touchId')" :hint="$t('settings.lock.touchIdHint')" :label-for="`${id}-touch-id`">
            <VSwitch :id="`${id}-touch-id`" :model-value="view.touchId" :disabled="busy" role="switch" @change="onTouchId($event)" />
          </SettingsRow>
        </SettingsList>
        <div class="flex flex-wrap gap-2">
          <VButton variant="neutral" icon="lucide:lock" :text="$t('settings.lock.lockNow')" @click="lockNow" />
          <VButton variant="neutral" :text="$t('settings.lock.changePin')" @click="open('change')" />
          <VButton variant="negative" :text="$t('settings.lock.disable')" @click="open('disable')" />
        </div>
      </template>

      <form
        v-if="mode !== 'idle'"
        class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm"
        @submit.prevent="submit"
      >
        <PinField v-if="mode !== 'enable'" v-model="current" :label="$t('settings.lock.currentPin')" autofocus />
        <template v-if="mode !== 'disable'">
          <PinField v-model="next" :label="$t('settings.lock.newPin')" :autofocus="mode === 'enable'" />
          <PinField v-model="repeat" :label="$t('settings.lock.repeatPin')" />
        </template>
        <div class="flex flex-wrap gap-2">
          <VButton type="submit" :text="$t(SUBMIT_TEXT[mode])" :loading="busy" />
          <VButton
            v-if="mode === 'disable' && view.touchId && view.touchIdAvailable"
            variant="neutral"
            icon="lucide:fingerprint-pattern"
            text="Touch ID"
            :disabled="busy"
            @click="disableWithTouchId"
          />
          <VButton variant="neutral" :text="$t('settings.lock.cancel')" :disabled="busy" @click="open('idle')" />
        </div>
      </form>

      <VInfoNotice v-if="error" role="alert" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </template>
  </SettingsSection>
</template>

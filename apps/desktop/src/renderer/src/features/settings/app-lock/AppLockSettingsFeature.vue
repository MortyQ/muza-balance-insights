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
    title="Блокировка"
    description="PIN закрывает приложение от тех, кто сядет за твой незаблокированный компьютер. Это замок на входе, а не шифрование: база шифруется отдельно, ключом из системного хранилища, и её ключ доступен твоей учётной записи и без PIN."
    note="Забытый PIN не восстановить — только удалить все данные."
  >
    <template v-if="view">
      <SettingsList v-if="!view.enabled && mode === 'idle'">
        <SettingsRow title="Блокировка выключена" hint="Приложение открывается без PIN.">
          <VButton text="Включить блокировку" icon="lucide:lock" @click="open('enable')" />
        </SettingsRow>
      </SettingsList>

      <template v-if="view.enabled && mode === 'idle'">
        <SettingsList heading="Когда блокировать">
          <SettingsRow v-for="t in LOCK_TRIGGERS" :key="t" :title="TRIGGER_LABELS[t]" :label-for="`${id}-${t}`">
            <VSwitch
              :id="`${id}-${t}`"
              :model-value="view.triggers[t]"
              :disabled="busy"
              role="switch"
              @change="onTrigger(t, $event)"
            />
          </SettingsRow>
        </SettingsList>
        <SettingsList v-if="view.touchIdAvailable">
          <SettingsRow title="Разблокировать по Touch ID" hint="Системный диалог сам предложит пароль Mac." :label-for="`${id}-touch-id`">
            <VSwitch :id="`${id}-touch-id`" :model-value="view.touchId" :disabled="busy" role="switch" @change="onTouchId($event)" />
          </SettingsRow>
        </SettingsList>
        <div class="flex flex-wrap gap-2">
          <VButton variant="neutral" icon="lucide:lock" text="Заблокировать сейчас" @click="lockNow" />
          <VButton variant="neutral" text="Сменить PIN" @click="open('change')" />
          <VButton variant="negative" text="Выключить блокировку" @click="open('disable')" />
        </div>
      </template>

      <form
        v-if="mode !== 'idle'"
        class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm"
        @submit.prevent="submit"
      >
        <PinField v-if="mode !== 'enable'" v-model="current" label="Текущий PIN" autofocus />
        <template v-if="mode !== 'disable'">
          <PinField v-model="next" label="Новый PIN — от 4 до 8 цифр" :autofocus="mode === 'enable'" />
          <PinField v-model="repeat" label="Повтори PIN" />
        </template>
        <div class="flex flex-wrap gap-2">
          <VButton type="submit" :text="SUBMIT_TEXT[mode]" :loading="busy" />
          <VButton
            v-if="mode === 'disable' && view.touchId && view.touchIdAvailable"
            variant="neutral"
            icon="lucide:fingerprint-pattern"
            text="Touch ID"
            :disabled="busy"
            @click="disableWithTouchId"
          />
          <VButton variant="neutral" text="Отмена" :disabled="busy" @click="open('idle')" />
        </div>
      </form>

      <VInfoNotice v-if="error" role="alert" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </template>
  </SettingsSection>
</template>

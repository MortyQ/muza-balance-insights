<script setup lang="ts">
import { LOCK_TRIGGERS } from '@contract/lock.ts';
import { VButton, VCard, VInfoNotice } from '@/shared/ui';
import PinField from './components/PinField.vue';
import { useLockSettings } from './composables/useLockSettings.ts';
import { SUBMIT_TEXT, TRIGGER_LABELS } from './constants.ts';
import { isChecked } from './utils.ts';

const { view, mode, current, next, repeat, busy, error, open, submit, disableWithTouchId, setTrigger, setTouchId, lockNow } = useLockSettings();
</script>

<template>
  <VCard title="Блокировка" padding="md">
    <div v-if="view" class="flex flex-col gap-4">
      <p class="text-sm text-foreground-muted">
        PIN закрывает приложение от тех, кто сядет за твой незаблокированный компьютер. Это замок на входе, а не шифрование: файлы
        базы на диске по-прежнему доступны твоей учётной записи. Забытый PIN не восстановить — только удалить все данные.
      </p>

      <div v-if="!view.enabled && mode === 'idle'">
        <VButton text="Включить блокировку" icon="lucide:lock" @click="open('enable')" />
      </div>

      <template v-if="view.enabled && mode === 'idle'">
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1 font-semibold">Когда блокировать</legend>
          <label v-for="t in LOCK_TRIGGERS" :key="t" class="flex items-center gap-2">
            <input class="accent-primary" type="checkbox" :checked="view.triggers[t]" :disabled="busy" @change="setTrigger(t, isChecked($event))" />
            {{ TRIGGER_LABELS[t] }}
          </label>
        </fieldset>
        <label v-if="view.touchIdAvailable" class="flex items-center gap-2">
          <input class="accent-primary" type="checkbox" :checked="view.touchId" :disabled="busy" @change="setTouchId(isChecked($event))" />
          Разблокировать по Touch ID
        </label>
        <div class="flex flex-wrap gap-2">
          <VButton variant="neutral" icon="lucide:lock" text="Заблокировать сейчас" @click="lockNow" />
          <VButton variant="neutral" text="Сменить PIN" @click="open('change')" />
          <VButton variant="negative" text="Выключить блокировку" @click="open('disable')" />
        </div>
      </template>

      <form v-if="mode !== 'idle'" class="flex flex-col gap-3 rounded-lg border border-border-subtle p-4" @submit.prevent="submit">
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

      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </div>
  </VCard>
</template>

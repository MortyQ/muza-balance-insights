<script setup lang="ts">
import { useId } from 'vue';
import { MONOBANK } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VCheckbox, VInfoNotice, VInput } from '@/shared/ui';
import { useAddConnection } from '../composables/useAddConnection.ts';
import { CONSENT_TEXT } from '../constants.ts';
import TokenField from './TokenField.vue';

const { defaultLabel = '', submitText = 'Подключить', autofocus = false } = defineProps<{
  defaultLabel?: string;
  submitText?: string;
  autofocus?: boolean;
}>();
const emit = defineEmits<{ added: [] }>();

const participant = useParticipantStore();
const { person, newLabel, fromBank, tokenInput, remember, canSubmit, submit, save } = useAddConnection(() => defaultLabel);
const personId = useId();

async function onSubmit() {
  if (await save()) emit('added');
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <div class="flex flex-col gap-2">
      <label :for="personId" class="font-semibold">Чьи это счета</label>
      <select :id="personId" v-model="person" class="h-(--control-h) w-full max-w-[420px] rounded-md border border-input-border bg-input-bg px-2">
        <option v-for="p in participant.people" :key="p.id" :value="p.id">{{ p.label }}</option>
        <option value="new">Новый человек</option>
      </select>
      <template v-if="person === 'new'">
        <VInput
          v-model="newLabel"
          :disabled="fromBank"
          maxlength="80"
          name="Имя"
          placeholder="Имя, например «Я» или «Оля»"
          type="text"
        />
        <VCheckbox v-model="fromBank" label="Взять имя из банка (подставится при первом импорте)" />
      </template>
    </div>
    <TokenField v-model:token="tokenInput" v-model:remember="remember" :bank="MONOBANK" :secure-storage="participant.secureStorage" :autofocus />
    <p class="text-sm text-foreground-muted">{{ CONSENT_TEXT }}</p>
    <div>
      <VButton type="submit" :text="submitText" :loading="submit.status === 'saving'" :disabled="!canSubmit" />
    </div>
    <VInfoNotice v-if="submit.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="submit.message" />
  </form>
</template>

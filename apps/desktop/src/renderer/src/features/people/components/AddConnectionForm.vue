<script setup lang="ts">
import { computed, useId } from 'vue';
import { MONOBANK } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VCheckbox, VInfoNotice, VInput, VSelect, type VSelectOption } from '@/shared/ui';
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

const personOptions = computed<VSelectOption[]>(() => [
  ...participant.people.map((p) => ({ label: p.label, value: p.id })),
  { label: 'Новый человек', value: 'new' },
]);

async function onSubmit() {
  if (await save()) emit('added');
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <div class="flex flex-col gap-2">
      <VSelect :id="personId" v-model="person" label="Чьи это счета" :options="personOptions" class="w-full max-w-[420px]" />
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

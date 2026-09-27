<script setup lang="ts">
import { computed, useId } from 'vue';
import { MONOBANK } from '@/entities/bank';
import { ColorSwatches, useParticipantStore } from '@/entities/participant';
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
const {
  person,
  newLabel,
  fromBank,
  tokenInput,
  remember,
  personColor,
  connectionColor,
  takenPersonColors,
  takenConnectionColors,
  canSubmit,
  submit,
  save,
} = useAddConnection(() => defaultLabel);
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
    <div class="flex flex-wrap gap-x-10 gap-y-4">
      <div v-if="person === 'new'" class="flex flex-col gap-2">
        <span class="text-sm font-medium text-foreground-secondary">Цвет человека</span>
        <ColorSwatches v-model="personColor" label="Цвет человека" :taken="takenPersonColors" />
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-foreground-secondary">Цвет подключения</span>
        <ColorSwatches v-model="connectionColor" label="Цвет подключения" :taken="takenConnectionColors" />
      </div>
    </div>
    <p class="-mt-2 text-sm text-foreground-muted">По цвету человека и подключения их будет легко различать на графиках. Цвет можно сменить позже.</p>
    <TokenField v-model:token="tokenInput" v-model:remember="remember" :bank="MONOBANK" :secure-storage="participant.secureStorage" :autofocus />
    <p class="text-sm text-foreground-muted">{{ CONSENT_TEXT }}</p>
    <div>
      <VButton type="submit" :text="submitText" :loading="submit.status === 'saving'" :disabled="!canSubmit" />
    </div>
    <VInfoNotice v-if="submit.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="submit.message" />
  </form>
</template>

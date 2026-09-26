<script setup lang="ts">
import { useId } from 'vue';
import { MONOBANK } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VInfoNotice } from '@/shared/ui';
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
const nameId = useId();

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
        <label :for="nameId" class="sr-only">Имя</label>
        <input
          :id="nameId"
          v-model="newLabel"
          class="h-(--control-h) w-full max-w-[420px] rounded-md border border-input-border bg-input-bg px-(--control-px) placeholder:text-input-placeholder focus:border-border-focus focus:outline-none disabled:text-foreground-disabled"
          type="text"
          maxlength="80"
          placeholder="Имя, например «Я» или «Оля»"
          :disabled="fromBank"
        />
        <label class="flex items-center gap-2">
          <input v-model="fromBank" class="accent-primary" type="checkbox" /> Взять имя из банка (подставится при первом импорте)
        </label>
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

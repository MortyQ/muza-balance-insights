<script setup lang="ts">
import { onMounted, useId, useTemplateRef } from 'vue';
import type { Bank } from '@/entities/bank';
import { useTokenStore } from '@/entities/token';
import { VButton, VInfoNotice } from '@/shared/ui';
import { useTokenForm } from '../composables/useTokenForm.ts';

const { bank, submitText = 'Подключить', autofocus = false } = defineProps<{
  bank: Readonly<Bank>;
  submitText?: string;
  autofocus?: boolean;
}>();
const emit = defineEmits<{ saved: [] }>();

const token = useTokenStore();
const { tokenInput, remember, submit, save } = useTokenForm();
const inputId = useId();
const input = useTemplateRef<HTMLInputElement>('input');

async function onSubmit() {
  if (await save()) emit('saved');
}

onMounted(() => {
  if (autofocus) input.value?.focus();
});
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
    <ol class="flex list-decimal flex-col gap-1 pl-5 text-foreground-secondary">
      <li v-for="step in bank.tokenSteps" :key="step">{{ step }}</li>
    </ol>
    <label :for="inputId" class="sr-only">Токен {{ bank.name }}</label>
    <input
      :id="inputId"
      ref="input"
      v-model="tokenInput"
      class="h-(--control-h) w-full max-w-[420px] rounded-md border border-input-border bg-input-bg px-(--control-px) placeholder:text-input-placeholder focus:border-border-focus focus:outline-none"
      type="password"
      autocomplete="off"
      spellcheck="false"
      :placeholder="bank.tokenPlaceholder"
    />
    <label class="flex items-center gap-2"><input v-model="remember" class="accent-primary" type="checkbox" /> Запомнить на этом компьютере</label>
    <VInfoNotice
      v-if="token.status && !token.status.secureStorage"
      :card="false"
      icon="lucide:triangle-alert"
      tone="warning"
      subtitle="На этом компьютере нет защищённого хранилища ключей: токен не будет сохранён, только в памяти до закрытия приложения."
    />
    <div>
      <VButton type="submit" :text="submitText" :loading="submit.status === 'saving'" :disabled="tokenInput.trim() === ''" />
    </div>
    <VInfoNotice v-if="submit.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="submit.message" />
  </form>
</template>

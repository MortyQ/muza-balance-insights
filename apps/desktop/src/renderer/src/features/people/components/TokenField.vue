<script setup lang="ts">
import { onMounted, useId, useTemplateRef } from 'vue';
import type { Bank } from '@/entities/bank';
import { VInfoNotice } from '@/shared/ui';

const { bank, secureStorage, autofocus = false } = defineProps<{
  bank: Readonly<Bank>;
  secureStorage: boolean;
  autofocus?: boolean;
}>();
const token = defineModel<string>('token', { required: true });
const remember = defineModel<boolean>('remember', { required: true });

const inputId = useId();
const input = useTemplateRef<HTMLInputElement>('input');

onMounted(() => {
  if (autofocus) input.value?.focus();
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <ol class="flex list-decimal flex-col gap-1 pl-5 text-foreground-secondary">
      <li v-for="step in bank.tokenSteps" :key="step">{{ step }}</li>
    </ol>
    <label :for="inputId" class="sr-only">Токен {{ bank.name }}</label>
    <input
      :id="inputId"
      ref="input"
      v-model="token"
      class="h-(--control-h) w-full max-w-[420px] rounded-md border border-input-border bg-input-bg px-(--control-px) placeholder:text-input-placeholder focus:border-border-focus focus:outline-none"
      type="password"
      autocomplete="off"
      spellcheck="false"
      :placeholder="bank.tokenPlaceholder"
    />
    <label class="flex items-center gap-2"><input v-model="remember" class="accent-primary" type="checkbox" /> Запомнить на этом компьютере</label>
    <VInfoNotice
      v-if="!secureStorage"
      :card="false"
      icon="lucide:triangle-alert"
      tone="warning"
      subtitle="На этом компьютере нет защищённого хранилища ключей: токен не будет сохранён, только в памяти до закрытия приложения."
    />
  </div>
</template>

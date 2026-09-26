<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';
import type { Bank } from '@/entities/bank';
import { VCheckbox, VInfoNotice, VInput } from '@/shared/ui';

const { bank, secureStorage, autofocus = false } = defineProps<{
  bank: Readonly<Bank>;
  secureStorage: boolean;
  autofocus?: boolean;
}>();
const token = defineModel<string>('token', { required: true });
const remember = defineModel<boolean>('remember', { required: true });

const input = useTemplateRef<{ focus: () => void }>('input');

onMounted(() => {
  if (autofocus) input.value?.focus();
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <ol class="flex list-decimal flex-col gap-1 pl-5 text-foreground-secondary">
      <li v-for="step in bank.tokenSteps" :key="step">{{ step }}</li>
    </ol>
    <VInput
      ref="input"
      v-model="token"
      :name="`Токен ${bank.name}`"
      :placeholder="bank.tokenPlaceholder"
      autocomplete="off"
      spellcheck="false"
      type="password"
    />
    <VCheckbox v-model="remember" label="Запомнить на этом компьютере" />
    <VInfoNotice
      v-if="!secureStorage"
      :card="false"
      icon="lucide:triangle-alert"
      tone="warning"
      subtitle="На этом компьютере нет защищённого хранилища ключей: токен не будет сохранён, только в памяти до закрытия приложения."
    />
  </div>
</template>

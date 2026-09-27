<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';
import { MONOBANK } from '@/entities/bank';
import { VCheckbox, VInfoNotice, VInput } from '@/shared/ui';
import type { TokenFieldProps } from '../../shared/types.ts';
import { TOKEN_PLACEHOLDER, TOKEN_STEPS } from '../constants.ts';

const { secureStorage, autofocus = false } = defineProps<TokenFieldProps>();
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
      <li v-for="step in TOKEN_STEPS" :key="step">{{ step }}</li>
    </ol>
    <VInput
      ref="input"
      v-model="token"
      :name="`Токен ${MONOBANK.name}`"
      :placeholder="TOKEN_PLACEHOLDER"
      autocomplete="off"
      spellcheck="false"
      type="password"
    >
      <!-- No reveal toggle: the token is pasted, not typed, and should not be shown on screen. -->
      <template #icon-right />
    </VInput>
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

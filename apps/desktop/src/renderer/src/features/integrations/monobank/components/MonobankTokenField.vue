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
      <li v-for="step in TOKEN_STEPS" :key="step">{{ $t(step) }}</li>
    </ol>
    <VInput
      ref="input"
      v-model="token"
      :name="$t('integrations.monobank.tokenName', { bank: $t(MONOBANK.name) })"
      :placeholder="$t(TOKEN_PLACEHOLDER)"
      autocomplete="off"
      spellcheck="false"
      type="password"
    >
      <!-- No reveal toggle: the token is pasted, not typed, and should not be shown on screen. -->
      <template #icon-right />
    </VInput>
    <VCheckbox v-model="remember" :label="$t('integrations.monobank.remember')" />
    <VInfoNotice
      v-if="!secureStorage"
      :card="false"
      icon="lucide:triangle-alert"
      tone="warning"
      :subtitle="$t('integrations.monobank.noSecureStorage')"
    />
  </div>
</template>

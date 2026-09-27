<script setup lang="ts">
import { useParticipantStore } from '@/entities/participant';
import { VButton, VInfoNotice } from '@/shared/ui';
import MonobankTokenField from './components/MonobankTokenField.vue';
import { useMonobankConnect } from './composables/useMonobankConnect.ts';
import { CONSENT_TEXT } from './constants.ts';
import type { ConnectFormProps } from '../shared/types.ts';

// The owner fields come in the default slot, at the top of the form.
const { owner, submitText, autofocus } = defineProps<ConnectFormProps>();
const emit = defineEmits<{ added: [] }>();

const participant = useParticipantStore();
const { tokenInput, remember, canSubmit, submit, save } = useMonobankConnect(() => owner);

async function onSubmit() {
  if (await save()) emit('added');
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <slot />
    <MonobankTokenField v-model:token="tokenInput" v-model:remember="remember" :secure-storage="participant.secureStorage" :autofocus />
    <p class="text-sm text-foreground-muted">{{ CONSENT_TEXT }}</p>
    <div>
      <VButton type="submit" :text="submitText" :loading="submit.status === 'saving'" :disabled="!canSubmit" />
    </div>
    <VInfoNotice v-if="submit.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="submit.message" />
  </form>
</template>

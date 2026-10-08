<script setup lang="ts">
import type { ProviderKey } from '@contract/api.ts';
import { VButton, VInfoNotice } from '@/shared/ui';
import type { ConnectFormProps } from '../../shared/types.ts';
import { useFileConnect } from '../composables/useFileConnect.ts';

// The owner fields come in the default slot, at the top of the form, as in a bank's token form.
const { provider, owner, submitText } = defineProps<ConnectFormProps & { provider: ProviderKey }>();
const emit = defineEmits<{ added: [] }>();

const { submit, save } = useFileConnect(() => provider, () => owner);

async function onSubmit() {
  if (await save()) emit('added');
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <slot />
    <p class="text-sm text-foreground-muted">{{ $t('integrations.file.connectNote') }}</p>
    <div>
      <VButton type="submit" :text="submitText" :loading="submit.status === 'saving'" :disabled="owner === null" />
    </div>
    <VInfoNotice v-if="submit.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="submit.message" />
  </form>
</template>

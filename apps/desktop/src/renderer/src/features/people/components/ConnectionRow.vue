<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ConnectionView } from '@contract/api.ts';
import { BANKS, BankMark, MONOBANK } from '@/entities/bank';
import { coverageLine, tokenLine } from '@/entities/participant';
import { VButton } from '@/shared/ui';
import TokenField from './TokenField.vue';

const { connection, secureStorage } = defineProps<{ connection: Readonly<ConnectionView>; secureStorage: boolean }>();
const emit = defineEmits<{
  setToken: [token: string, remember: boolean, done: (saved: boolean) => void];
  remove: [];
}>();

const bank = computed(() => BANKS.find((b) => b.id === connection.provider) ?? MONOBANK);
const editing = ref(false);
const tokenInput = ref('');
const remember = ref(true);

function save() {
  emit('setToken', tokenInput.value, remember.value, (saved) => {
    if (saved) editing.value = false;
  });
  // The token never stays in the renderer.
  tokenInput.value = '';
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg border border-border-subtle px-3 py-2">
    <div class="flex flex-wrap items-center gap-3">
      <BankMark :bank />
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="font-semibold">{{ connection.bank }}</span>
        <span class="text-sm" :class="connection.token.present ? 'text-foreground-muted' : 'text-warning'">{{ tokenLine(connection.token) }}</span>
        <span class="text-sm text-foreground-muted">{{ coverageLine(connection) }}</span>
      </div>
      <VButton variant="neutral" :text="editing ? 'Отмена' : 'Ввести токен заново'" @click="editing = !editing" />
      <VButton variant="neutral" text="Удалить" @click="emit('remove')" />
    </div>
    <form v-if="editing" class="flex flex-col gap-3" @submit.prevent="save">
      <TokenField v-model:token="tokenInput" v-model:remember="remember" :bank :secure-storage autofocus />
      <div>
        <VButton type="submit" text="Сохранить" :disabled="tokenInput.trim() === ''" />
      </div>
    </form>
  </div>
</template>

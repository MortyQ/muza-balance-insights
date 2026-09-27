<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import type { ConnectionView } from '@contract/api.ts';
import { BankMark, bankOf } from '@/entities/bank';
import { coverageLine, tokenBadge, tokenLine } from '@/entities/participant';
import { EXPAND_TRANSITION } from '@/shared/lib';
import { VButton } from '@/shared/ui';

const { connection, secureStorage, tokenField } = defineProps<{
  connection: Readonly<ConnectionView>;
  secureStorage: boolean;
  /** The bank's token field (v-model:token, v-model:remember, secureStorage, autofocus): «Ввести токен заново». */
  tokenField: Component;
}>();
const emit = defineEmits<{
  setToken: [token: string, remember: boolean, done: (saved: boolean) => void];
  remove: [];
}>();

const bank = computed(() => bankOf(connection.provider));
const badge = computed(() => tokenBadge(connection.token));
const editing = ref(false);
const tokenInput = ref('');
const remember = ref(true);

function toggleToken() {
  editing.value = !editing.value;
}

function save() {
  emit('setToken', tokenInput.value, remember.value, (saved) => {
    if (saved) editing.value = false;
  });
  // The token never stays in the renderer.
  tokenInput.value = '';
}
</script>

<template>
  <div class="flex flex-col px-4 py-3">
    <div class="flex flex-col gap-5">
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <BankMark :bank size="sm" />
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="font-semibold">{{ connection.bank }}</span>
            <span class="text-sm text-foreground-muted">{{ coverageLine(connection) }}</span>
          </div>
        </div>
        <span
          :title="tokenLine(connection.token)"
          class="inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current"
          :class="
            badge.tone === 'success'
              ? 'bg-success-subtle text-success'
              : 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning'
          "
        >
          {{ badge.text }}
        </span>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <VButton
          :variant="connection.token.present ? 'neutral' : 'primary'"
          :text="editing ? 'Отмена' : connection.token.present ? 'Ввести токен заново' : 'Ввести токен'"
          @click="toggleToken"
        />
        <VButton variant="negative" text="Удалить" @click="emit('remove')" />
      </div>
    </div>
    <!-- The gap lives inside the expanding box (pt-5), so nothing jumps when it opens or closes. -->
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="editing" class="grid">
        <div class="-mx-1 min-h-0 overflow-hidden px-1">
          <form class="flex flex-col gap-3 pt-5 pb-1" @submit.prevent="save">
            <component :is="tokenField" v-model:token="tokenInput" v-model:remember="remember" :secure-storage autofocus />
            <div>
              <VButton type="submit" text="Сохранить" :disabled="tokenInput.trim() === ''" />
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, type Component } from 'vue';
import type { ConnectionAccountView, ConnectionView } from '@contract/api.ts';
import { BankMark, bankOf } from '@/entities/bank';
import { coverageLine, tokenBadge, tokenLine } from '@/entities/participant';
import { SettingsList, SettingsRow } from '@/shared/layout';
import { EXPAND_TRANSITION } from '@/shared/lib';
import { VButton, VSwitch } from '@/shared/ui';
import { DISABLED_ACCOUNT_HINT, IMPORT_RUNNING_ACCOUNTS_TEXT } from '../constants.ts';
import type { AccountsState } from '../types.ts';
import { accountLabel } from '../utils.ts';

const { connection, secureStorage, tokenField, accounts, cardTypes, importRunning, savingAccount } = defineProps<{
  connection: Readonly<ConnectionView>;
  secureStorage: boolean;
  /** The bank's token field (v-model:token, v-model:remember, secureStorage, autofocus): «Ввести токен заново». */
  tokenField: Component;
  /** «Счета»: undefined until first opened. */
  accounts: AccountsState | undefined;
  /** The bank's card types → names. */
  cardTypes: Readonly<Record<string, string>>;
  /** The switches wait for the import to end. */
  importRunning: boolean;
  /** The account whose switch is being saved. */
  savingAccount: string | null;
}>();
const emit = defineEmits<{
  setToken: [token: string, remember: boolean, done: (saved: boolean) => void];
  remove: [];
  /** «Счета» opened: load the list. */
  openAccounts: [];
  setAccountEnabled: [accountId: string, enabled: boolean, done: (changed: boolean) => void];
}>();

const id = useId();
const bank = computed(() => bankOf(connection.provider));
const badge = computed(() => tokenBadge(connection.token));
const panel = ref<'token' | 'accounts' | null>(null);
const tokenInput = ref('');
const remember = ref(true);

function toggleToken() {
  panel.value = panel.value === 'token' ? null : 'token';
}

function toggleAccounts() {
  panel.value = panel.value === 'accounts' ? null : 'accounts';
  if (panel.value === 'accounts') emit('openAccounts');
}

function onSwitch(a: Readonly<ConnectionAccountView>, e: Event) {
  if (!(e.target instanceof HTMLInputElement)) return;
  const input = e.target;
  // The browser flips the input before @change; a refused or failed save puts it back.
  emit('setAccountEnabled', a.id, input.checked, (changed) => {
    if (!changed) input.checked = a.enabled;
  });
}

function save() {
  emit('setToken', tokenInput.value, remember.value, (saved) => {
    if (saved) panel.value = null;
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
          v-if="connection.accounts > 0"
          variant="neutral"
          :text="`Счета · ${connection.accounts}`"
          :aria-expanded="panel === 'accounts'"
          @click="toggleAccounts"
        />
        <VButton
          :variant="connection.token.present ? 'neutral' : 'primary'"
          :text="panel === 'token' ? 'Отмена' : connection.token.present ? 'Ввести токен заново' : 'Ввести токен'"
          :aria-expanded="panel === 'token'"
          @click="toggleToken"
        />
        <VButton variant="negative" text="Удалить" @click="emit('remove')" />
      </div>
    </div>
    <!-- The gap lives inside the expanding box (pt-5), so nothing jumps when it opens or closes. -->
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="panel === 'token'" class="grid">
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
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="panel === 'accounts'" class="grid">
        <div class="-mx-1 min-h-0 overflow-hidden px-1">
          <div class="flex flex-col gap-2 pt-5 pb-1">
            <p v-if="accounts === undefined || accounts.status === 'loading'" class="text-sm text-foreground-muted">Загружаю счета…</p>
            <p v-else-if="accounts.status === 'error'" class="text-sm text-foreground-muted">Не удалось загрузить счета.</p>
            <p v-else-if="accounts.accounts.length === 0" class="text-sm text-foreground-muted">Счета появятся после первого импорта.</p>
            <template v-else>
              <p v-if="importRunning" class="text-sm text-foreground-muted">{{ IMPORT_RUNNING_ACCOUNTS_TEXT }}</p>
              <SettingsList>
                <SettingsRow
                  v-for="a in accounts.accounts"
                  :key="a.id"
                  :title="accountLabel(a, cardTypes)"
                  :hint="a.enabled ? undefined : DISABLED_ACCOUNT_HINT"
                  :label-for="`${id}-${a.id}`"
                >
                  <VSwitch
                    :id="`${id}-${a.id}`"
                    :model-value="a.enabled"
                    :disabled="importRunning || savingAccount !== null"
                    role="switch"
                    @change="onSwitch(a, $event)"
                  />
                </SettingsRow>
              </SettingsList>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

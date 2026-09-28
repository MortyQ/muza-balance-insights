<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { bankOf } from '@/entities/bank';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { EXPAND_TRANSITION, t } from '@/shared/lib';
import { VButton, VInfoNotice } from '@/shared/ui';
import AddConnectionFeature from './AddConnectionFeature.vue';
import { DEFAULT_PROVIDER } from './constants.ts';
import ConnectionRow from './shared/components/ConnectionRow.vue';
import { useConnectionActions } from './shared/composables/useConnectionActions.ts';
import { formsOf, newConnectionTitle } from './utils.ts';

const participant = useParticipantStore();
const importProgress = useImportProgressStore();
const { error, setToken, remove, accounts, loadAccounts, savingAccount, setAccountEnabled } = useConnectionActions();
const newTitle = computed(() => newConnectionTitle(t(bankOf(DEFAULT_PROVIDER).name)));
const adding = ref(false);
const added = ref(false);

onMounted(() => void participant.refresh().catch(() => undefined));

function startAdding() {
  adding.value = true;
  added.value = false;
}

function onAdded() {
  adding.value = false;
  added.value = true;
}

async function onSetAccountEnabled(connectionId: number, accountId: string, enabled: boolean, done: (changed: boolean) => void) {
  done(await setAccountEnabled(connectionId, accountId, enabled));
}

async function onSetToken(connectionId: number, token: string, remember: boolean, done: (saved: boolean) => void) {
  done(await setToken(connectionId, token, remember));
}
</script>

<template>
  <SettingsSection
    title="Подключения"
    description="Банк и токен, по которому приложение читает выписку. Токен даёт только чтение: переводить деньги с ним нельзя. В «Счета» можно выключить счёт: он не загружается и не входит в статистику."
    note="Подключай чужой счёт только с согласия владельца токена. «Удалить» стирает подключение, его токен и загруженные операции в этом приложении; в банке ничего не меняется."
  >
    <p v-if="!participant.hasConnections" class="text-foreground-secondary">Подключений пока нет.</p>
    <template v-for="p in participant.people" :key="p.id">
      <SettingsList v-if="p.connections.length > 0" :heading="p.label">
        <ConnectionRow
          v-for="c in p.connections"
          :key="c.id"
          :connection="c"
          :secure-storage="participant.secureStorage"
          :token-field="formsOf(c.provider).tokenField"
          :accounts="accounts.get(c.id)"
          :card-types="formsOf(c.provider).cardTypes"
          :import-running="importProgress.running"
          :saving-account
          @set-token="(token, remember, done) => onSetToken(c.id, token, remember, done)"
          @remove="remove(c.id)"
          @open-accounts="loadAccounts(c.id)"
          @set-account-enabled="(accountId, enabled, done) => onSetAccountEnabled(c.id, accountId, enabled, done)"
        />
      </SettingsList>
    </template>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    <VInfoNotice
      v-if="added"
      :card="false"
      icon="lucide:check-circle"
      tone="success"
      :subtitle="
        importProgress.running
          ? 'Подключение добавлено. Оно загрузится со следующим импортом.'
          : 'Подключение добавлено. Нажми «Загрузить» на главном экране — загрузятся все подключения.'
      "
    />
    <!-- One slot for the button and the panel: the section's gap stays the same while the panel slides. -->
    <div>
      <VButton v-if="!adding" text="Добавить подключение" icon="lucide:plus" @click="startAdding" />
      <Transition v-bind="EXPAND_TRANSITION">
        <div v-if="adding" class="grid">
          <div class="-m-1 min-h-0 overflow-hidden p-1">
            <div class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-base font-semibold">{{ newTitle }}</h3>
                <VButton variant="neutral" text="Отмена" @click="adding = false" />
              </div>
              <AddConnectionFeature :provider="DEFAULT_PROVIDER" submit-text="Добавить" autofocus @added="onAdded" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </SettingsSection>
</template>

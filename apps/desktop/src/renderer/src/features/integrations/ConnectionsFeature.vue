<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ProviderId } from '@contract/api.ts';
import { BANKS, type Bank, bankOf, isProviderId } from '@/entities/bank';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { EXPAND_TRANSITION, t } from '@/shared/lib';
import { VButton, VInfoNotice } from '@/shared/ui';
import AddConnectionFeature from './AddConnectionFeature.vue';
import BankPicker from './shared/components/BankPicker.vue';
import ConnectionRow from './shared/components/ConnectionRow.vue';
import StatementUploadFeature from './statement-file/StatementUploadFeature.vue';
import { useConnectionActions } from './shared/composables/useConnectionActions.ts';
import { fileStepsOf, formsOf, newConnectionTitle } from './utils.ts';

const participant = useParticipantStore();
const importProgress = useImportProgressStore();
const { error, setToken, remove, accounts, loadAccounts, savingAccount, setAccountEnabled } = useConnectionActions();
const adding = ref(false);
const added = ref(false);
// The bank being added: picked in the panel while the registry has several, else the only one.
const onlyBank = BANKS.length === 1 ? (BANKS[0]?.id ?? null) : null;
const picked = ref<ProviderId | null>(null);
const provider = computed<ProviderId | null>(() => picked.value ?? (onlyBank !== null && isProviderId(onlyBank) ? onlyBank : null));
const newTitle = computed(() => (provider.value ? newConnectionTitle(bankOf(provider.value).name) : t('integrations.connections.add')));

function pick(bank: Readonly<Bank>) {
  if (isProviderId(bank.id)) picked.value = bank.id;
}

onMounted(() => void participant.refresh().catch(() => undefined));

function startAdding() {
  picked.value = null;
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
    :title="$t('integrations.connections.title')"
    :description="$t('integrations.connections.description')"
    :note="$t('integrations.connections.note')"
  >
    <p v-if="!participant.hasConnections" class="text-foreground-secondary">{{ $t('integrations.connections.none') }}</p>
    <template v-for="p in participant.people" :key="p.id">
      <SettingsList v-if="p.connections.length > 0" :heading="p.label">
        <ConnectionRow
          v-for="c in p.connections"
          :key="c.id"
          :connection="c"
          :secure-storage="participant.secureStorage"
          :token-field="formsOf(c.provider)?.tokenField ?? null"
          :accounts="accounts.get(c.id)"
          :statement-files="fileStepsOf(c.provider) !== null"
          :import-running="importProgress.running"
          :saving-account
          @set-token="(token, remember, done) => onSetToken(c.id, token, remember, done)"
          @remove="remove(c.id)"
          @open-accounts="loadAccounts(c.id)"
          @set-account-enabled="(accountId, enabled, done) => onSetAccountEnabled(c.id, accountId, enabled, done)"
        >
          <template #statement>
            <StatementUploadFeature v-if="fileStepsOf(c.provider)" :connection="c" :steps="fileStepsOf(c.provider) ?? []" />
          </template>
        </ConnectionRow>
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
          ? $t('integrations.connections.addedDuringImport')
          : $t('integrations.connections.added')
      "
    />
    <!-- One slot for the button and the panel: the section's gap stays the same while the panel slides. -->
    <div>
      <VButton v-if="!adding" :text="$t('integrations.connections.add')" icon="lucide:plus" @click="startAdding" />
      <Transition v-bind="EXPAND_TRANSITION">
        <div v-if="adding" class="grid">
          <div class="-m-1 min-h-0 overflow-hidden p-1">
            <div class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-base font-semibold">{{ newTitle }}</h3>
                <VButton variant="neutral" :text="$t('integrations.connections.cancel')" @click="adding = false" />
              </div>
              <template v-if="provider">
                <div v-if="picked">
                  <VButton variant="link" icon="lucide:chevron-left" :text="$t('integrations.first.otherBank')" @click="picked = null" />
                </div>
                <AddConnectionFeature :key="provider" :provider :submit-text="$t('integrations.add.submitShort')" autofocus @added="onAdded" />
              </template>
              <BankPicker v-else @select="pick" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </SettingsSection>
</template>

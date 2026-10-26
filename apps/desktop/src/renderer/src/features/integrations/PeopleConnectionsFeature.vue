<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ColorKey, ProviderId } from '@contract/api.ts';
import { BANKS, type Bank, bankOf, isProviderId } from '@/entities/bank';
import { useImportProgressStore } from '@/entities/import-progress';
import { colorHolders, useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { EXPAND_TRANSITION, t } from '@/shared/lib';
import { VButton, VInfoNotice } from '@/shared/ui';
import AddConnectionFeature from './AddConnectionFeature.vue';
import PersonBlock from './people/components/PersonBlock.vue';
import { usePeopleActions } from './people/composables/usePeopleActions.ts';
import BankPicker from './shared/components/BankPicker.vue';
import ConnectionRow from './shared/components/ConnectionRow.vue';
import { useConnectionActions } from './shared/composables/useConnectionActions.ts';
import type { PersonChoice } from './shared/types.ts';
import StatementUploadFeature from './statement-file/StatementUploadFeature.vue';
import { connectionsByBank, fileStepsOf, formsOf, newConnectionTitle } from './utils.ts';

const participant = useParticipantStore();
const importProgress = useImportProgressStore();
const { error, setToken, remove, accounts, loadAccounts, savingAccount, setAccountEnabled } = useConnectionActions();
const people = usePeopleActions();
// Whose add panel is open (a person's id, or 'new' for «Add person»); one at a time. `added` — where the notice goes.
const adding = ref<PersonChoice | null>(null);
const added = ref<PersonChoice | null>(null);
// The bank being added: picked in the panel while the registry has several, else the only one.
const onlyBank = BANKS.length === 1 ? (BANKS[0]?.id ?? null) : null;
const picked = ref<ProviderId | null>(null);
const provider = computed<ProviderId | null>(() => picked.value ?? (onlyBank !== null && isProviderId(onlyBank) ? onlyBank : null));
const newTitle = computed(() => (provider.value ? newConnectionTitle(bankOf(provider.value).name) : t('integrations.connections.add')));

// Settings open from the menu on any screen: show the current people, not what was loaded at start.
onMounted(() => void participant.refresh().catch(() => undefined));

function pick(bank: Readonly<Bank>) {
  if (isProviderId(bank.id)) picked.value = bank.id;
}

function startAdding(whose: PersonChoice) {
  picked.value = null;
  adding.value = whose;
  added.value = null;
}

function onAdded() {
  // A new person's id is not known here: the notice goes under the list.
  added.value = adding.value;
  adding.value = null;
}

async function onSetAccountEnabled(connectionId: number, accountId: string, enabled: boolean, done: (changed: boolean) => void) {
  done(await setAccountEnabled(connectionId, accountId, enabled));
}

async function onSetToken(connectionId: number, token: string, remember: boolean, done: (saved: boolean) => void) {
  done(await setToken(connectionId, token, remember));
}

async function onRename(id: number, label: string, done: (saved: boolean) => void) {
  done(await people.rename(id, label));
}

async function onRestoreBankName(id: number, done: (saved: boolean) => void) {
  done(await people.restoreBankName(id));
}

function onColor(id: number, color: ColorKey) {
  void people.setPersonColor(id, color);
}
</script>

<template>
  <SettingsSection
    :title="$t('integrations.people.title')"
    :description="$t('integrations.people.description')"
    :note="$t('integrations.people.note')"
  >
    <p v-if="participant.people.length === 0" class="text-foreground-secondary">{{ $t('integrations.people.empty') }}</p>
    <SettingsList v-for="p in participant.people" :key="p.id">
      <PersonBlock
        :person="p"
        :taken-colors="colorHolders(participant.people, p.id)"
        @rename="(label, done) => onRename(p.id, label, done)"
        @restore-bank-name="(done) => onRestoreBankName(p.id, done)"
        @color="(color) => onColor(p.id, color)"
      />
      <template v-for="g in connectionsByBank(p.connections)" :key="g.bank.id">
        <h4 class="px-4 pt-3 pb-1 text-xs font-semibold text-foreground-secondary">{{ g.bank.name }}</h4>
        <ConnectionRow
          v-for="c in g.connections"
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
      </template>
      <div class="flex flex-col gap-3 px-4 py-3">
        <VInfoNotice
          v-if="added === p.id"
          :card="false"
          icon="lucide:check-circle"
          tone="success"
          :subtitle="importProgress.running ? $t('integrations.connections.addedDuringImport') : $t('integrations.connections.added')"
        />
        <div v-if="adding !== p.id">
          <VButton variant="link" icon="lucide:plus" :text="$t('integrations.connections.add')" @click="startAdding(p.id)" />
        </div>
        <Transition v-bind="EXPAND_TRANSITION">
          <div v-if="adding === p.id" class="grid">
            <div class="-m-1 min-h-0 overflow-hidden p-1">
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-base font-semibold">{{ newTitle }}</h3>
                  <VButton variant="neutral" :text="$t('integrations.connections.cancel')" @click="adding = null" />
                </div>
                <template v-if="provider">
                  <div v-if="picked">
                    <VButton variant="link" icon="lucide:chevron-left" :text="$t('integrations.first.otherBank')" @click="picked = null" />
                  </div>
                  <AddConnectionFeature
                    :key="provider"
                    :provider
                    :for-person="p.id"
                    :submit-text="$t('integrations.add.submitShort')"
                    autofocus
                    @added="onAdded"
                  />
                </template>
                <BankPicker v-else @select="pick" />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </SettingsList>
    <VInfoNotice v-if="error || people.error.value" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error || people.error.value" />
    <VInfoNotice
      v-if="added === 'new'"
      :card="false"
      icon="lucide:check-circle"
      tone="success"
      :subtitle="importProgress.running ? $t('integrations.connections.addedDuringImport') : $t('integrations.connections.added')"
    />
    <!-- One slot for the button and the panel: the section's gap stays the same while the panel slides. -->
    <div>
      <VButton v-if="adding !== 'new'" :text="$t('integrations.people.add')" icon="lucide:plus" @click="startAdding('new')" />
      <Transition v-bind="EXPAND_TRANSITION">
        <div v-if="adding === 'new'" class="grid">
          <div class="-m-1 min-h-0 overflow-hidden p-1">
            <div class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-base font-semibold">{{ $t('integrations.people.add') }} · {{ newTitle }}</h3>
                <VButton variant="neutral" :text="$t('integrations.connections.cancel')" @click="adding = null" />
              </div>
              <template v-if="provider">
                <div v-if="picked">
                  <VButton variant="link" icon="lucide:chevron-left" :text="$t('integrations.first.otherBank')" @click="picked = null" />
                </div>
                <AddConnectionFeature
                  :key="provider"
                  :provider
                  for-person="new"
                  :submit-text="$t('integrations.add.submitShort')"
                  autofocus
                  @added="onAdded"
                />
              </template>
              <BankPicker v-else @select="pick" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </SettingsSection>
</template>

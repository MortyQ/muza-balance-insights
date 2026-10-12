<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue';
import type { ProviderKey } from '@contract/api.ts';
import { ALL_BANKS, bankOf, bankOptions, optionProvider } from '@/entities/bank';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { EXPAND_TRANSITION, t } from '@/shared/lib';
import { VButton, VInfoNotice, VSelect } from '@/shared/ui';
import AddConnectionFeature from './AddConnectionFeature.vue';
import { DEFAULT_PROVIDER } from './constants.ts';
import ConnectionRow from './shared/components/ConnectionRow.vue';
import { useConnectionActions } from './shared/composables/useConnectionActions.ts';
import { formsOf, newConnectionTitle, peopleOfBank } from './utils.ts';

const participant = useParticipantStore();
const importProgress = useImportProgressStore();
const { error, setToken, remove, accounts, loadAccounts, savingAccount, setAccountEnabled } = useConnectionActions();
const newTitle = computed(() => newConnectionTitle(t(bankOf(DEFAULT_PROVIDER).name)));
const adding = ref(false);
const added = ref(false);

// The section's own choice of bank: it narrows the list below and tells the toolbar's slot what to refresh. Not the
// data filter of the home screens.
const bankId = useId();
const bank = ref<string>(ALL_BANKS);
const provider = computed<ProviderKey | null>(() => optionProvider(participant.providers, bank.value));
const bankValue = computed<string | number | null>({
  // A bank whose last connection was removed reads as «All banks».
  get: () => provider.value ?? ALL_BANKS,
  set: (v) => {
    if (typeof v === 'string') bank.value = v;
  },
});
const people = computed(() => peopleOfBank(participant.people, provider.value));
const shown = computed(() => people.value.reduce((n, p) => n + p.connections.length, 0));

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
    :title="$t('integrations.connections.title')"
    :description="$t('integrations.connections.description')"
    :note="$t('integrations.connections.note')"
  >
    <template #action>
      <VButton v-if="!adding" :text="$t('integrations.connections.add')" icon="lucide:plus" @click="startAdding" />
    </template>
    <!-- The form opens right under the title, where its button is. -->
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="adding" class="grid">
        <div class="-m-1 min-h-0 overflow-hidden p-1">
          <div class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-base font-semibold">{{ newTitle }}</h3>
              <VButton variant="neutral" :text="$t('integrations.connections.cancel')" @click="adding = false" />
            </div>
            <AddConnectionFeature :provider="DEFAULT_PROVIDER" :submit-text="$t('integrations.add.submitShort')" autofocus @added="onAdded" />
          </div>
        </div>
      </div>
    </Transition>
    <p v-if="!participant.hasConnections" class="text-foreground-secondary">{{ $t('integrations.connections.none') }}</p>
    <!-- The bank filter (several banks only) and whatever the caller puts next to it: «Refresh» of the chosen bank. -->
    <div
      v-else-if="participant.multipleBanks || $slots.toolbar"
      data-test="connections-toolbar"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2.5"
    >
      <div v-if="participant.multipleBanks" class="flex items-center gap-2">
        <label :for="bankId" class="pl-1 font-semibold">{{ $t('home.filters.bank') }}</label>
        <VSelect :id="bankId" v-model="bankValue" :options="bankOptions(participant.providers)" :disabled="importProgress.running" />
      </div>
      <span v-else class="pl-1 font-semibold">{{ $t('home.filters.refresh.title') }}</span>
      <slot name="toolbar" :provider />
    </div>
    <template v-for="p in people" :key="p.id">
      <SettingsList :heading="p.label">
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
    <p v-if="provider !== null" data-test="connections-shown" class="flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
      {{ $t('integrations.connections.shown', { shown, total: participant.connections.length }) }}
      <VButton variant="link" :text="$t('integrations.connections.showAll')" @click="bank = ALL_BANKS" />
    </p>
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
  </SettingsSection>
</template>

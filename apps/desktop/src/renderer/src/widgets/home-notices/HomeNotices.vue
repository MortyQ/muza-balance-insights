<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { importLink, ROUTE } from '@/shared/config';
import { fullDate, monthName, t } from '@/shared/lib';
import { VButton, VInfoNotice } from '@/shared/ui';
import { ALL_ACCOUNTS_OFF_TEXT } from './constants.ts';
import { emptyMonth, noTokenText } from './utils.ts';

const router = useRouter();
const participant = useParticipantStore();
const syncStatus = useSyncStatusStore();
const importProgress = useImportProgressStore();
const monthStore = useMonthStore();

function openConnections() {
  void router.push({ name: ROUTE.settings, query: { section: 'connections' } });
}
function openImport(from?: string) {
  void router.push(importLink(from));
}
// The user's own import is on: the data is on its way, no call to download it.
const userImport = computed(() => importProgress.running && !importProgress.auto);
// Known to be empty: not while the status is unknown or could not be read.
const noData = computed(() => syncStatus.status !== null && !syncStatus.failed && !syncStatus.hasData);
const empty = computed(() =>
  syncStatus.hasData && !userImport.value ? emptyMonth(monthStore.month, syncStatus.status?.dataFrom ?? null, monthStore.today) : null,
);
const emptyText = computed(() => {
  if (!empty.value) return '';
  const [y, m] = monthStore.month.split('-');
  return t('home.notices.monthEmpty', { month: `${monthName(Number(m))} ${y}`, date: fullDate(empty.value.dataFrom) });
});
// Only file connections: the data comes from statement uploads, not from the import.
const filesOnly = computed(() => participant.hasConnections && participant.connections.every((c) => c.method === 'file'));
const showNoToken = computed(() => participant.withoutToken.length > 0);
const text = computed(() =>
  noTokenText(participant.withoutToken, participant.connections.length, importProgress.progress.phase, participant.labelOf),
);
</script>

<template>
  <VInfoNotice
    v-if="syncStatus.failed"
    :card="false"
    icon="lucide:circle-alert"
    tone="danger"
    :subtitle="$t('home.notices.readFailed')"
  />
  <div v-if="showNoToken" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3">
    <VInfoNotice :card="false" icon="lucide:plug" tone="warning" :subtitle="text" />
    <VButton :text="$t('home.notices.enterToken')" @click="openConnections" />
  </div>
  <div v-if="noData" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3">
    <VInfoNotice v-if="userImport" :card="false" icon="lucide:download" tone="info" :subtitle="$t('home.notices.importing')" />
    <template v-else>
      <VInfoNotice
        :card="false"
        icon="lucide:inbox"
        tone="info"
        :title="$t('home.notices.noDataTitle')"
        :subtitle="filesOnly ? $t('home.notices.noDataFileText') : $t('home.notices.noDataText')"
      />
      <VButton v-if="filesOnly" :text="$t('home.notices.uploadStatement')" icon="lucide:file-up" @click="openConnections" />
      <VButton v-else :text="$t('home.notices.loadHistory')" icon="lucide:download" @click="openImport()" />
    </template>
  </div>
  <div v-if="empty" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3">
    <VInfoNotice :card="false" icon="lucide:calendar-x" tone="info" :subtitle="emptyText" />
    <VButton v-if="filesOnly" :text="$t('home.notices.uploadStatement')" icon="lucide:file-up" @click="openConnections" />
    <VButton v-else :text="$t('home.notices.loadMonth')" icon="lucide:download" @click="openImport(empty.from)" />
  </div>
  <div
    v-if="participant.accountsOff"
    class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3"
  >
    <VInfoNotice :card="false" icon="lucide:eye-off" tone="warning" :subtitle="$t(ALL_ACCOUNTS_OFF_TEXT)" />
    <VButton :text="$t('home.notices.openConnections')" @click="openConnections" />
  </div>
</template>

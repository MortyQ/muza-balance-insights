<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { ROUTE } from '@/shared/config';
import { VButton, VInfoNotice } from '@/shared/ui';
import { noTokenText } from './utils.ts';

const router = useRouter();
const participant = useParticipantStore();
const syncStatus = useSyncStatusStore();
const importProgress = useImportProgressStore();

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
    subtitle="Не удалось прочитать данные. Перезапусти приложение; если повторится — пришли строки [ipc] из терминала."
  />
  <div v-if="showNoToken" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3">
    <VInfoNotice :card="false" icon="lucide:plug" tone="warning" :subtitle="text" />
    <VButton text="Ввести токен" @click="router.push({ name: ROUTE.settings })" />
  </div>
</template>

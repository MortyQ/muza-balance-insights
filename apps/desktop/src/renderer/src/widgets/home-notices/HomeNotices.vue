<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useImportProgressStore } from '@/entities/import-progress';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useTokenStore } from '@/entities/token';
import { ROUTE } from '@/shared/config';
import { VButton, VInfoNotice } from '@/shared/ui';
import { noTokenText } from './utils.ts';

const router = useRouter();
const token = useTokenStore();
const syncStatus = useSyncStatusStore();
const importProgress = useImportProgressStore();

const showNoToken = computed(() => token.status !== null && !token.connected);
const text = computed(() => noTokenText(token.status, importProgress.progress.phase));
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
    <VButton text="Подключить" @click="router.push({ name: ROUTE.settings })" />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useSyncStatusStore } from '@/entities/sync-status';
import { ROUTE } from '@/shared/config';
import { VButton } from '@/shared/ui';

const router = useRouter();
const syncStatus = useSyncStatusStore();
</script>

<template>
  <header class="flex items-center justify-between gap-3">
    <h1 class="text-xl font-semibold">Balance Insights</h1>
    <div class="flex items-center gap-3">
      <span v-if="syncStatus.line" class="text-sm text-foreground-muted tabular-nums">{{ syncStatus.line }}</span>
      <VButton variant="neutral" icon="lucide:settings" title="Настройки (⌘,)" aria-label="Настройки" @click="router.push({ name: ROUTE.settings })" />
    </div>
  </header>
</template>

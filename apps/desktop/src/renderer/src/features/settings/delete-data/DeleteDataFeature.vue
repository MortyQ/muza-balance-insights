<script setup lang="ts">
import { SettingsSection } from '@/shared/layout';
import { VButton, VInfoNotice } from '@/shared/ui';
import { useDeleteData } from './composables/useDeleteData.ts';

const emit = defineEmits<{ deleted: [] }>();
const { deleting, error, run } = useDeleteData();

async function onDelete() {
  if (await run()) emit('deleted');
}
</script>

<template>
  <SettingsSection :title="$t('settings.deleteData.title')" :description="$t('settings.deleteData.description')">
    <div class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
      <h3 class="text-lg font-semibold">{{ $t('settings.deleteData.heading') }}</h3>
      <p class="max-w-[62ch] text-sm text-foreground-secondary">{{ $t('settings.deleteData.body') }}</p>
      <div class="flex justify-end">
        <VButton variant="negative" :text="$t('settings.deleteData.button')" icon="lucide:trash" :loading="deleting" @click="onDelete" />
      </div>
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </div>
  </SettingsSection>
</template>

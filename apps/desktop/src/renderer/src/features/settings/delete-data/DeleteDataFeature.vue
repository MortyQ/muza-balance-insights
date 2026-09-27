<script setup lang="ts">
import { VButton, VInfoNotice } from '@/shared/ui';
import { useDeleteData } from './composables/useDeleteData.ts';
import SettingsSection from '../shared/components/SettingsSection.vue';

const emit = defineEmits<{ deleted: [] }>();
const { deleting, error, run } = useDeleteData();

async function onDelete() {
  if (await run()) emit('deleted');
}
</script>

<template>
  <SettingsSection title="Данные" description="Всё, что приложение сохранило на этом компьютере.">
    <div class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
      <h3 class="text-lg font-semibold">Удалить все данные</h3>
      <p class="max-w-[62ch] text-sm text-foreground-secondary">
        Стирает базу операций и её ключ, сохранённые токены, блокировку и незавершённый импорт. В банке ничего не меняется, но
        загружать выписку придётся заново. Перед удалением приложение спросит подтверждение.
      </p>
      <div class="flex justify-end">
        <VButton variant="negative" text="Удалить все данные" icon="lucide:trash" :loading="deleting" @click="onDelete" />
      </div>
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { VButton, VCard, VInfoNotice } from '@/shared/ui';
import { useDeleteData } from './composables/useDeleteData.ts';

const emit = defineEmits<{ deleted: [] }>();
const { deleting, error, run } = useDeleteData();

async function onDelete() {
  if (await run()) emit('deleted');
}
</script>

<template>
  <VCard title="Данные на этом компьютере" padding="md">
    <div class="flex flex-col gap-3">
      <p class="text-sm text-foreground-muted">
        Операции хранятся только здесь, в базе приложения. «Удалить все данные» стирает базу, сохранённый токен и незавершённый
        импорт; перед удалением приложение спросит подтверждение.
      </p>
      <div>
        <VButton variant="negative" text="Удалить все данные" icon="lucide:trash" :loading="deleting" @click="onDelete" />
      </div>
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </div>
  </VCard>
</template>

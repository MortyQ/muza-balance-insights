<script setup lang="ts">
import { ref } from 'vue';
import { BankMark, MONOBANK } from '@/entities/bank';
import { tokenLine, useTokenStore } from '@/entities/token';
import { VButton, VCard, VInfoNotice } from '@/shared/ui';
import TokenForm from './components/TokenForm.vue';
import { useDisconnect } from './composables/useDisconnect.ts';

const token = useTokenStore();
const { error, disconnect } = useDisconnect();
const editing = ref(false);

async function onDisconnect() {
  if (await disconnect()) editing.value = false;
}
</script>

<template>
  <VCard title="Подключённые банки" padding="md">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <BankMark :bank="MONOBANK" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="font-semibold">{{ MONOBANK.name }}</span>
          <span class="text-sm text-foreground-muted">{{ tokenLine(token.status) }}</span>
        </div>
        <template v-if="token.connected">
          <VButton variant="neutral" :text="editing ? 'Отмена' : 'Заменить токен'" @click="editing = !editing" />
          <VButton variant="neutral" text="Отключить" @click="onDisconnect" />
        </template>
        <VButton v-else-if="!editing" text="Подключить" @click="editing = true" />
      </div>
      <TokenForm v-if="editing" :bank="MONOBANK" :submit-text="token.connected ? 'Сохранить' : 'Подключить'" autofocus @saved="editing = false" />
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
      <p class="text-sm text-foreground-muted">«Отключить» удаляет только токен: загруженные операции остаются.</p>
    </div>
  </VCard>
</template>

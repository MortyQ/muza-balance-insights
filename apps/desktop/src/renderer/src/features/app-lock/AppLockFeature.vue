<script setup lang="ts">
import { PIN_MIN } from '@contract/lock.ts';
import { VButton, VCard, VInfoNotice } from '@/shared/ui';
import PinField from './components/PinField.vue';
import { useUnlock } from './composables/useUnlock.ts';

const { pin, busy, error, wait, broken, touchId, canForget, importRunning, submitPin, unlockTouchId, forgot } = useUnlock();
</script>

<template>
  <VCard title="Приложение заблокировано" padding="md" class="w-full max-w-sm">
    <div class="flex flex-col gap-4">
      <form v-if="!broken" class="flex flex-col gap-3" @submit.prevent="submitPin">
        <PinField v-model="pin" label="PIN" autofocus :disabled="busy || wait !== ''" />
        <div class="flex flex-wrap gap-2">
          <VButton type="submit" text="Войти" :loading="busy" :disabled="pin.length < PIN_MIN || wait !== ''" />
          <VButton v-if="touchId" variant="neutral" icon="lucide:fingerprint-pattern" text="Touch ID" :disabled="busy" @click="unlockTouchId" />
        </div>
      </form>
      <p v-else class="text-foreground-secondary">Файл блокировки повреждён. Открыть приложение можно, только удалив все данные.</p>
      <p v-if="wait" class="text-sm text-foreground-muted">{{ wait }}</p>
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
      <p v-if="importRunning" class="text-sm text-foreground-muted">Идёт импорт — он продолжается, пока приложение заблокировано.</p>
      <div v-if="canForget" class="flex flex-col items-start gap-1">
        <p class="text-sm text-foreground-muted">PIN нельзя восстановить: можно только удалить все данные и загрузить выписку заново.</p>
        <VButton variant="link" text="Забыли PIN?" @click="forgot" />
      </div>
    </div>
  </VCard>
</template>

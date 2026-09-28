<script setup lang="ts">
import { PIN_MIN } from '@contract/lock.ts';
import { VButton, VCard, VInfoNotice } from '@/shared/ui';
import PinField from './components/PinField.vue';
import { useUnlock } from './composables/useUnlock.ts';

const { pin, busy, error, wait, broken, touchId, canForget, importRunning, submitPin, unlockTouchId, forgot } = useUnlock();
</script>

<template>
  <VCard title="Balance Insights" :subtitle="$t('settings.lock.locked')" padding="md" class="w-full max-w-sm">
    <div class="flex flex-col gap-4">
      <form v-if="!broken" class="flex flex-col gap-3" @submit.prevent="submitPin">
        <PinField v-model="pin" :label="$t('settings.lock.pin')" autofocus :disabled="busy || wait !== ''" />
        <div class="flex flex-wrap gap-2">
          <VButton type="submit" :text="$t('settings.lock.signIn')" :loading="busy" :disabled="pin.length < PIN_MIN || wait !== ''" />
          <VButton v-if="touchId" variant="neutral" icon="lucide:fingerprint-pattern" text="Touch ID" :disabled="busy" @click="unlockTouchId" />
        </div>
      </form>
      <p v-else class="text-foreground-secondary">{{ $t('settings.lock.broken') }}</p>
      <p v-if="wait" aria-hidden="true" class="text-sm text-foreground-muted">{{ wait }}</p>
      <p class="sr-only" aria-live="polite">{{ wait ? $t('settings.lock.tooManySr') : '' }}</p>
      <VInfoNotice v-if="error" role="alert" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
      <p v-if="importRunning" class="text-sm text-foreground-muted">{{ $t('settings.lock.importRunning') }}</p>
      <div v-if="canForget" class="flex flex-col items-start gap-1">
        <p class="text-sm text-foreground-muted">{{ $t('settings.lock.cannotRestore') }}</p>
        <VButton variant="link" :text="$t('settings.lock.forgot')" :disabled="busy" @click="forgot" />
      </div>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { VButton, VCard, VInfoNotice } from '@/shared/ui';
import { useDbRecovery } from './composables/useDbRecovery.ts';
import { ACTION_TEXT } from './constants.ts';

const { text, busy, error, run } = useDbRecovery();
</script>

<template>
  <VCard v-if="text" title="Balance Insights" :subtitle="text.title" padding="md" class="w-full max-w-md">
    <div class="flex flex-col gap-4">
      <p class="text-foreground-secondary">{{ text.detail }}</p>
      <p class="text-sm text-foreground-muted">{{ $t('settings.dbRecovery.startOverHint') }}</p>
      <div class="flex flex-wrap gap-2">
        <VButton
          :variant="text.primary === 'relaunch' ? 'primary' : 'neutral'"
          icon="lucide:refresh-cw"
          :text="$t(ACTION_TEXT.relaunch)"
          :loading="busy === 'relaunch'"
          :disabled="busy !== null"
          @click="run('relaunch')"
        />
        <VButton
          :variant="text.primary === 'startOver' ? 'primary' : 'neutral'"
          :text="$t(ACTION_TEXT.startOver)"
          :loading="busy === 'startOver'"
          :disabled="busy !== null"
          @click="run('startOver')"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <VButton
          variant="negative"
          icon="lucide:trash"
          :text="$t(ACTION_TEXT.delete)"
          :loading="busy === 'delete'"
          :disabled="busy !== null"
          @click="run('delete')"
        />
        <VButton variant="neutral" :text="$t(ACTION_TEXT.quit)" :disabled="busy !== null" @click="run('quit')" />
      </div>
      <VInfoNotice v-if="error" role="alert" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </div>
  </VCard>
</template>

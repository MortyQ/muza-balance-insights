<script setup lang="ts">
import { computed } from 'vue';
import type { ProviderKey } from '@contract/api.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VInfoNotice } from '@/shared/ui';
import { useRefresh } from './composables/useRefresh.ts';
import { hasTokenFor, refreshButtonText, refreshStatus } from './utils.ts';

const { provider = null } = defineProps<{
  /** The bank to refresh; null — every bank. */
  provider?: ProviderKey | null;
}>();

const participant = useParticipantStore();
const importProgress = useImportProgressStore();
const { line, error, busy, refresh } = useRefresh(() => provider);
// Main would refuse with «no token» anyway: the button says so before the click.
const hasToken = computed(() => hasTokenFor(participant.connections, provider));
const status = computed(() => refreshStatus({ running: importProgress.running, auto: importProgress.auto, hasToken: hasToken.value, line: line.value }));
const text = computed(() => refreshButtonText(provider, participant.multipleBanks));
</script>

<template>
  <!-- `contents`: the status with the button and the refusal under them are items of the caller's row. -->
  <div class="contents">
    <div class="ml-auto flex flex-wrap items-center justify-end gap-3">
      <span
        data-test="refresh-status"
        class="text-sm tabular-nums"
        :class="status.warning ? 'text-warning-foreground dark:text-warning' : 'text-foreground-muted'"
      >
        {{ status.text }}
      </span>
      <VButton data-test="refresh-button" variant="neutral" :text icon="lucide:refresh-cw" :disabled="busy || !hasToken" @click="refresh" />
    </div>
    <VInfoNotice v-if="error" class="basis-full" :card="false" icon="lucide:circle-alert" tone="warning" :subtitle="error" />
  </div>
</template>

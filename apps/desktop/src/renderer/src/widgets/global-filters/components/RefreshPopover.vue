<script setup lang="ts">
import { computed, useId } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VInfoNotice, VPopover, VSelect } from '@/shared/ui';
import { useRefresh } from '../composables/useRefresh.ts';
import { bankOptions } from '../utils.ts';

// Next to the sync status, only when more than one bank is connected: with one, the row stays as it was.
const participant = useParticipantStore();
const id = useId();
const { bank, line, error, busy, refresh } = useRefresh();
const options = computed(() => bankOptions(participant.providers));
// VSelect's model also allows a number and null; the options are strings only.
const value = computed<string | number | null>({
  get: () => bank.value,
  set: (v) => {
    if (typeof v === 'string') bank.value = v;
  },
});
</script>

<template>
  <span v-if="participant.multipleBanks" data-test="refresh-trigger" class="inline-flex">
    <VPopover icon="lucide:refresh-cw" :label="$t('home.filters.refresh.title')">
      <div class="flex flex-col gap-2 p-2">
        <label :for="id" class="text-xs font-semibold text-foreground-muted">{{ $t('home.filters.refresh.title') }}</label>
        <VSelect :id v-model="value" :options :disabled="busy" />
        <p class="text-sm text-foreground-muted tabular-nums">{{ line }}</p>
        <VButton :text="$t('home.filters.refresh.button')" icon="lucide:refresh-cw" :disabled="busy" @click="refresh" />
        <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="warning" :subtitle="error" />
      </div>
    </VPopover>
  </span>
</template>

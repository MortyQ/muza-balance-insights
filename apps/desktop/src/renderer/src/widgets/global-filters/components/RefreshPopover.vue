<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { ALL_BANKS, bankOptions, optionProvider } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { useRefresh } from '@/features/bank-refresh';
import { VButton, VInfoNotice, VPopover, VSelect } from '@/shared/ui';

// Next to the sync status, only when more than one bank is connected: with one, the row stays as it was.
const participant = useParticipantStore();
const id = useId();
// The popover's own choice: `ALL_BANKS` or a provider id.
const bank = ref<string>(ALL_BANKS);
const { line, error, busy, refresh } = useRefresh(() => optionProvider(participant.providers, bank.value));
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

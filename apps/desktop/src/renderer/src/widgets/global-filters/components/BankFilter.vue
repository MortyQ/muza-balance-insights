<script setup lang="ts">
import { computed, useId } from 'vue';
import { ALL_BANKS, bankOptions, optionProvider } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { VSelect } from '@/shared/ui';

// Shown only when more than one bank is connected: with one there is nothing to narrow, and the row stays as it was.
const participant = useParticipantStore();
const id = useId();
const options = computed(() => bankOptions(participant.providers));
// VSelect's model also allows a number and null; the options are «all» and the connected banks only.
const value = computed<string | number | null>({
  get: () => participant.selectedProvider ?? ALL_BANKS,
  set: (v) => {
    if (v === ALL_BANKS) participant.selectProvider(null);
    else participant.selectProvider(optionProvider(participant.providers, v) ?? participant.selectedProvider);
  },
});
</script>

<template>
  <div v-if="participant.multipleBanks" data-test="bank-filter">
    <label :for="id" class="sr-only">{{ $t('home.filters.bank') }}</label>
    <VSelect :id v-model="value" :options />
  </div>
</template>

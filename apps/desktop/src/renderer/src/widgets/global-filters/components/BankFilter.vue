<script setup lang="ts">
import { computed } from 'vue';
import type { ProviderId } from '@contract/api.ts';
import { BankMark, bankOf } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { VToggleGroup } from '@/shared/ui';

// The bank filter (spec desktop-bank-filter): here and not in entities/participant, since it shows the banks' marks and
// one entity does not import another. The choice itself is the participant store's — the view's.
const participant = useParticipantStore();
const options = computed(() => participant.banks.map((id) => ({ label: bankOf(id).name, value: id })));
const value = computed<ReadonlyArray<ProviderId>>({
  get: () => participant.shown,
  set: (next) => participant.selectBanks(next),
});
</script>

<template>
  <VToggleGroup
    v-if="participant.banks.length > 1"
    v-model="value"
    :options
    :group-label="$t('home.filters.banks')"
    :locked-hint="$t('home.filters.banksLocked')"
    required
  >
    <template #label="{ option }">
      <BankMark :bank="bankOf(option.value)" size="xs" />
      <!-- Below 45rem the marks alone; the names stay for screen readers. -->
      <span class="max-[45rem]:sr-only">{{ option.label }}</span>
    </template>
  </VToggleGroup>
</template>

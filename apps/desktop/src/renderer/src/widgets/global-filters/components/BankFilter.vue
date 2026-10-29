<script setup lang="ts">
import { computed, useId } from 'vue';
import type { ProviderId } from '@contract/api.ts';
import { BankMark, bankOf } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { VPopover, VSwitch } from '@/shared/ui';
import { BANK_MARKS_MAX } from '../constants.ts';
import { bankFilterText } from '../utils.ts';

// The bank filter (spec desktop-bank-filter): here and not in entities/participant, since it shows the banks' marks and
// one entity does not import another. The choice itself is the participant store's — the view's.
const participant = useParticipantStore();
const id = useId();
const text = computed(() => bankFilterText(participant.shown.length, participant.banks.length));
const marks = computed(() => participant.shown.slice(0, BANK_MARKS_MAX));
const more = computed(() => participant.shown.length - marks.value.length);
const isOn = (bank: ProviderId) => participant.shown.includes(bank);
// The last bank on cannot turn off: its switch is disabled and says why.
const locked = (bank: ProviderId) => participant.shown.length === 1 && isOn(bank);

function set(bank: ProviderId, on: boolean): void {
  participant.selectBanks(on ? [...participant.shown, bank] : participant.shown.filter((b) => b !== bank));
}
</script>

<template>
  <VPopover
    v-if="participant.banks.length > 1"
    icon="lucide:chevron-down"
    :text
    :label="$t('home.filters.banksButton', { shown: text })"
    align="start"
  >
    <template #trigger>
      <span class="flex items-center">
        <BankMark v-for="bank in marks" :key="bank" :bank="bankOf(bank)" size="xs" class="-ml-1 ring-2 ring-input-bg first:ml-0" />
        <span v-if="more > 0" class="ml-1 text-xs text-foreground-muted">+{{ more }}</span>
      </span>
    </template>
    <div class="flex flex-col gap-1" role="group" :aria-label="$t('home.filters.banks')">
      <p class="px-2 pt-2 text-xs font-semibold text-foreground-muted">{{ $t('home.filters.banks') }}</p>
      <div v-for="bank in participant.banks" :key="bank" class="flex items-center gap-3 rounded-lg px-2 py-2">
        <BankMark :bank="bankOf(bank)" size="sm" />
        <span class="flex grow flex-col">
          <label :for="`${id}-${bank}`" class="cursor-pointer font-semibold">{{ bankOf(bank).name }}</label>
          <span v-if="locked(bank)" :id="`${id}-${bank}-hint`" class="text-xs text-foreground-muted">{{ $t('home.filters.banksLocked') }}</span>
        </span>
        <VSwitch
          :id="`${id}-${bank}`"
          :model-value="isOn(bank)"
          :disabled="locked(bank)"
          role="switch"
          :aria-describedby="locked(bank) ? `${id}-${bank}-hint` : undefined"
          @update:model-value="set(bank, $event)"
        />
      </div>
    </div>
  </VPopover>
</template>

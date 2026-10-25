<script setup lang="ts">
import { computed } from 'vue';
import { BANK_CARDS, NEUTRAL_CARD } from '../constants.ts';
import type { AccountCardProps } from '../types.ts';

// The skin of the account's bank, or the neutral card for a bank without one; the click falls through to its root button.
const { bank, ...figures } = defineProps<AccountCardProps>();
const skin = computed(() => (Object.hasOwn(BANK_CARDS, bank) ? BANK_CARDS[bank as keyof typeof BANK_CARDS] : undefined) ?? NEUTRAL_CARD);
</script>

<template>
  <component :is="skin" v-bind="figures" />
</template>

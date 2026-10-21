<script setup lang="ts">
import { BANK_CARDS } from '../constants.ts';
import type { AccountCardProps } from '../types.ts';

// The skin of the account's bank; the click falls through to its root button.
const { bank, ...figures } = defineProps<AccountCardProps>();
</script>

<template>
  <component :is="BANK_CARDS[bank]" v-bind="figures" />
</template>

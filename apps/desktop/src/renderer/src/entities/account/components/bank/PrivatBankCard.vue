<script setup lang="ts">
import type { BankCardProps } from '../../types.ts';
import CardShell from './CardShell.vue';

// PrivatBank's «Universal» card: deep blue with a fine woven texture and the bank's green tag top left.
const { variant: _variant, ...figures } = defineProps<BankCardProps>();
defineEmits<{ click: [] }>();

// The bank's wordmark: a brand mark, never translated (like a logo).
const WORDMARK = 'PrivatBank';
</script>

<template>
  <CardShell v-bind="figures" class="bg-[linear-gradient(135deg,#2160b8_0%,#14468f_55%,#0e3470_100%)]" @click="$emit('click')">
    <template #art>
      <span
        class="absolute inset-0 opacity-25 bg-[repeating-linear-gradient(45deg,rgb(255_255_255/.12)_0_1px,transparent_1px_6px),repeating-linear-gradient(-45deg,rgb(255_255_255/.08)_0_1px,transparent_1px_6px)]"
      />
    </template>
    <template #brand>
      <span class="rounded-md bg-[#5cae2f] px-2 py-1 text-sm leading-none font-extrabold text-white shadow-sm" data-test="card-wordmark">{{ WORDMARK }}</span>
    </template>
  </CardShell>
</template>

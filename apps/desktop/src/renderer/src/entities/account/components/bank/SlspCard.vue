<script setup lang="ts">
import type { BankCardProps } from '../../types.ts';
import CardShell from './CardShell.vue';

// Slovenská sporiteľňa's card: the Erste blue with a large open arc off the right edge.
const { variant: _variant, ...figures } = defineProps<BankCardProps>();
defineEmits<{ click: [] }>();

// The bank's wordmark in its two lines: a brand mark, never translated (like a logo).
const WORDMARK = ['SLOVENSKÁ', 'sporiteľňa'] as const;
</script>

<template>
  <CardShell v-bind="figures" class="bg-[linear-gradient(135deg,#2d74ee_0%,#1f5fd6_55%,#174cb0_100%)]" @click="$emit('click')">
    <template #art>
      <span class="absolute -right-[70px] -bottom-[90px] size-[250px] rotate-[30deg] rounded-full border-[30px] border-white/85 border-l-transparent" />
    </template>
    <template #brand>
      <span class="flex flex-col leading-none" data-test="card-wordmark">
        <span class="text-[13px] font-extrabold tracking-wide">{{ WORDMARK[0] }}</span>
        <span class="text-xs font-semibold">{{ WORDMARK[1] }}</span>
      </span>
    </template>
  </CardShell>
</template>

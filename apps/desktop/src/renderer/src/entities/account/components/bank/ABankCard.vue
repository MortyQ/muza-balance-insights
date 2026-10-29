<script setup lang="ts">
import type { BankCardProps } from '../../types.ts';
import CardShell from './CardShell.vue';

// A-Bank's card: bright green with a large stylised apple drawn in shapes (no logo file).
const { variant: _variant, ...figures } = defineProps<BankCardProps>();
defineEmits<{ click: [] }>();

// The bank's wordmark: a brand mark, never translated (like a logo).
const WORDMARK = 'A-Bank';
</script>

<template>
  <CardShell v-bind="figures" class="bg-[linear-gradient(135deg,#6cc23a_0%,#3f9d22_55%,#2b7d16_100%)]" @click="$emit('click')">
    <template #art>
      <!-- The apple: two overlapping circles and a leaf, off the right edge. -->
      <span class="absolute -right-10 bottom-[-46px] size-[168px] rounded-full bg-white/14" />
      <span class="absolute right-[52px] bottom-[-34px] size-[150px] rounded-full bg-white/10" />
      <span class="absolute top-[34px] right-[62px] h-[44px] w-[24px] rotate-[35deg] rounded-[100%_0] bg-white/18" />
    </template>
    <template #brand>
      <span class="text-lg leading-none font-extrabold tracking-tight" data-test="card-wordmark">{{ WORDMARK }}</span>
    </template>
  </CardShell>
</template>

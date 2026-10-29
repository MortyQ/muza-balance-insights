<script setup lang="ts">
import { computed } from 'vue';
import type { BankCardProps, CardTone } from '../../types.ts';
import CardShell from './CardShell.vue';

const { variant, ...figures } = defineProps<BankCardProps>();
defineEmits<{ click: [] }>();

// The bank's wordmark: a brand mark, never translated (like a logo).
const WORDMARK = 'monobank';
// Monobank's card by its type (spec desktop-balance-cards); a jar and any other type — the black card.
const LOOKS: Record<string, { tone: CardTone; paint: string }> = {
  black: { tone: 'dark', paint: 'bg-[linear-gradient(140deg,#2b2b30_0%,#0e0e10_55%,#1c1c20_100%)]' },
  white: { tone: 'light', paint: 'bg-[linear-gradient(140deg,#ffffff_0%,#eef0f3_60%,#dfe2e8_100%)]' },
  iron: { tone: 'dark', paint: 'bg-[linear-gradient(140deg,#62666d_0%,#3b3e43_55%,#50545a_100%)]' },
  platinum: { tone: 'light', paint: 'bg-[linear-gradient(140deg,#eeeff1_0%,#c8cbd0_55%,#f3f4f6_100%)]' },
  yellow: { tone: 'light', paint: 'bg-[linear-gradient(140deg,#ffe36e_0%,#f6c700_60%,#ffd84a_100%)]' },
};
const look = computed(() => LOOKS[variant ?? 'black'] ?? LOOKS.black!);
</script>

<template>
  <CardShell v-bind="figures" :tone="look.tone" :class="look.paint" @click="$emit('click')">
    <template #brand>
      <span class="text-lg leading-none font-extrabold tracking-tight" data-test="card-wordmark">{{ WORDMARK }}</span>
    </template>
  </CardShell>
</template>

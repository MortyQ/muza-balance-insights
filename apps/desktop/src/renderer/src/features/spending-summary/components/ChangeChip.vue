<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { ChipView } from '../types.ts';

const { chip, size = 'md' } = defineProps<{ chip: ChipView; size?: 'sm' | 'md' }>();
const TONE = {
  up: 'bg-[color-mix(in_oklch,var(--series-orange)_16%,var(--surface))] text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]',
  down: 'bg-[color-mix(in_oklch,var(--series-blue)_16%,var(--surface))] text-[color-mix(in_oklch,var(--series-blue)_72%,var(--foreground))]',
  neutral: 'bg-surface-sunken text-foreground-secondary',
} as const;
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full text-xs font-bold tabular-nums"
    :class="[TONE[chip.tone], size === 'sm' ? 'h-5.5 px-2' : 'h-6 px-2.5']"
    :title="chip.title"
  >
    <VIcon v-if="chip.arrow" :icon="chip.arrow === 'up' ? 'lucide:arrow-up-right' : 'lucide:arrow-down-right'" class="size-3" />
    {{ chip.text }}
  </span>
</template>

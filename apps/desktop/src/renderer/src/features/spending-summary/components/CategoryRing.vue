<script setup lang="ts">
import { VChangeChip } from '@/shared/ui';
import type { ChipView } from '../types.ts';

const { stops, label, amount, perDay, chip, conv } = defineProps<{
  stops: string;
  label: string;
  amount: string;
  perDay: string | null;
  chip: ChipView | null;
  conv: ReadonlyArray<{ text: string; chip: ChipView | null; title: string }>;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="relative size-52.5">
      <div class="absolute inset-0 rounded-full bg-(image:--ring)" :style="{ '--ring': stops }" aria-hidden="true" />
      <div class="absolute inset-6.75 flex flex-col items-center justify-center gap-0.5 rounded-full bg-surface px-2 text-center">
        <span class="max-w-full truncate text-xs text-foreground-muted">{{ label }}</span>
        <span class="whitespace-nowrap text-2xl font-bold tabular-nums">{{ amount }}</span>
        <span v-if="perDay" class="whitespace-nowrap text-xs text-foreground-muted">{{ perDay }}</span>
        <span v-for="c in conv" :key="c.text" class="inline-flex items-center gap-1 whitespace-nowrap text-xs text-foreground-secondary tabular-nums" :title="c.title">
          {{ c.text }}
          <VChangeChip v-if="c.chip" :chip="c.chip" size="sm" />
        </span>
      </div>
    </div>
    <VChangeChip v-if="chip" :chip />
  </div>
</template>

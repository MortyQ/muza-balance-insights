<script setup lang="ts">
import type { ChipView } from '../types.ts';
import ChangeChip from './ChangeChip.vue';

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
    <div class="relative size-52.5 rounded-full bg-(image:--ring)" :style="{ '--ring': stops }" aria-hidden="true">
      <div class="absolute inset-6.75 flex flex-col items-center justify-center gap-0.5 rounded-full bg-surface px-2 text-center">
        <span class="max-w-full truncate text-xs text-foreground-muted">{{ label }}</span>
        <span class="whitespace-nowrap text-2xl font-bold tabular-nums">{{ amount }}</span>
        <span v-if="perDay" class="whitespace-nowrap text-xs text-foreground-muted">{{ perDay }}</span>
        <span v-for="c in conv" :key="c.text" class="whitespace-nowrap text-[11px] text-foreground-secondary tabular-nums" :title="c.title">
          {{ c.text }}
          <span v-if="c.chip" class="font-bold">{{ c.chip.text }}</span>
        </span>
      </div>
    </div>
    <ChangeChip v-if="chip" :chip />
  </div>
</template>

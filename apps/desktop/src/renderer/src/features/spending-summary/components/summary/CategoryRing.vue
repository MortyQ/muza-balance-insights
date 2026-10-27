<script setup lang="ts">
import { computed } from 'vue';
import { VChangeChip, VChart } from '@/shared/ui';
import type { ChipView, RingPart } from '../../types.ts';
import { ringOption } from '../../utils/index.ts';

const { parts, label, amount, perDay, chip, conv } = defineProps<{
  parts: ReadonlyArray<RingPart>;
  label: string;
  amount: string;
  perDay: string | null;
  chip: ChipView | null;
  conv: ReadonlyArray<string>;
}>();

const option = computed(() => ringOption(parts));
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- A thin ring on a track: the categories' rounded arcs (spec desktop-spending-ring), the total inside. The list
         beside it says every name, amount and share, so the ring is hidden from screen readers. -->
    <div class="relative size-46">
      <VChart :option class="absolute inset-0" aria-hidden="true" />
      <div class="pointer-events-none absolute inset-3.5 flex flex-col items-center justify-center gap-0.5 rounded-full bg-surface px-2 text-center">
        <span class="max-w-full truncate text-xs text-foreground-muted">{{ label }}</span>
        <span class="whitespace-nowrap text-xl font-bold tabular-nums">{{ amount }}</span>
        <span v-if="perDay" class="whitespace-nowrap text-xs text-foreground-muted">{{ perDay }}</span>
        <span v-for="c in conv" :key="c" class="whitespace-nowrap text-xs text-foreground-secondary tabular-nums">{{ c }}</span>
      </div>
    </div>
    <VChangeChip v-if="chip" :chip />
  </div>
</template>

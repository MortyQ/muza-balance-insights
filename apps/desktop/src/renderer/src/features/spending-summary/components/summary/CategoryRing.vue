<script setup lang="ts">
import { computed, ref } from 'vue';
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
// The segment under the pointer (series 1: the track is silent); its texts replace the total in the centre.
const hoveredIndex = ref<number | null>(null);
const hovered = computed(() => (hoveredIndex.value === null ? null : (parts[hoveredIndex.value] ?? null)));
function hover(item: { seriesIndex: number; dataIndex: number } | null): void {
  hoveredIndex.value = item && item.seriesIndex === 1 ? item.dataIndex : null;
}
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- A thin ring on a track: the categories' rounded arcs (spec desktop-spending-ring), the total inside — or the
         category under the pointer. The canvas is 8px (CANVAS_MARGIN) wider on every side, twice the hover growth: a widened segment stays whole.
         The list beside it says every name, amount and share to screen readers; the centre's swap is pointer-only. -->
    <div class="relative size-46">
      <!-- VChart fills its parent (its own styles), so the larger box is this wrapper's. -->
      <div class="absolute -inset-2"><VChart :option @hover="hover" /></div>
      <div v-if="hovered" class="pointer-events-none absolute inset-3.5 flex flex-col items-center justify-center gap-0.5 rounded-full bg-surface px-3 text-center" aria-hidden="true" data-test="ring-hovered">
        <span class="max-w-full truncate text-xs text-foreground-muted">{{ hovered.name }}</span>
        <span class="whitespace-nowrap text-xl font-bold tabular-nums">{{ hovered.amount }}</span>
        <span class="whitespace-nowrap text-xs text-foreground-muted">{{ hovered.share }}</span>
      </div>
      <div v-else class="pointer-events-none absolute inset-3.5 flex flex-col items-center justify-center gap-0.5 rounded-full bg-surface px-2 text-center">
        <span class="max-w-full truncate text-xs text-foreground-muted">{{ label }}</span>
        <span class="whitespace-nowrap text-xl font-bold tabular-nums">{{ amount }}</span>
        <span v-if="perDay" class="whitespace-nowrap text-xs text-foreground-muted">{{ perDay }}</span>
        <span v-for="c in conv" :key="c" class="whitespace-nowrap text-xs text-foreground-secondary tabular-nums">{{ c }}</span>
      </div>
    </div>
    <VChangeChip v-if="chip" :chip />
  </div>
</template>

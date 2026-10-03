<script setup lang="ts">
import type { WeekBar } from '../types.ts';

const { bars } = defineProps<{ bars: ReadonlyArray<WeekBar> }>();
// Decoration, hidden from screen readers: the amounts are in the text next to it.
const COLOR = { past: 'bg-primary-muted', today: 'bg-primary', future: 'bg-border' } as const;
</script>

<template>
  <div class="flex h-9 shrink-0 items-end gap-1" aria-hidden="true">
    <span
      v-for="(b, i) in bars"
      :key="i"
      class="w-2 rounded-sm"
      :class="[COLOR[b.kind], { 'h-0.5': b.height === 0 }]"
      :style="b.height > 0 ? { height: `${b.height}%` } : undefined"
    />
  </div>
</template>

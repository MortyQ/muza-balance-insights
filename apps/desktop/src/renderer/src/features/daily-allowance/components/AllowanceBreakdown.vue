<script setup lang="ts">
import type { BreakdownLine } from '../types.ts';

const { lines } = defineProps<{ lines: ReadonlyArray<BreakdownLine> }>();
</script>

<template>
  <dl class="flex flex-col divide-y divide-border-subtle text-sm">
    <div v-for="(l, i) in lines" :key="i" class="flex items-baseline justify-between gap-3 py-1.5">
      <dt class="min-w-0 truncate" :class="l.strong ? 'font-semibold' : 'text-foreground-secondary'" :title="l.label">{{ l.label }}</dt>
      <dd class="shrink-0 whitespace-nowrap tabular-nums" :class="{ 'font-bold': l.strong }">{{ l.amount }}</dd>
    </div>
  </dl>
</template>

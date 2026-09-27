<script setup lang="ts">
import { computed } from 'vue';
import type { Flow } from '../types.ts';
import { flowWidths, signedMoney } from '../utils.ts';

const { flow, size = 'sm' } = defineProps<{
  flow: Flow;
  /** sm — the thin bars under a card of the row; md — the month panel. */
  size?: 'sm' | 'md';
}>();

/** A bar part; zero-width parts are dropped (the 2 px gap and the rounded end belong to visible parts only). */
type Part = { w: number; color: string };

const rows = computed(() => {
  const { income, spending, currency, color, segments } = flow;
  const parts = (value: number, other: number, pick: 'income' | 'spending'): Part[] => {
    if (segments && segments.length > 0) {
      const widths = flowWidths(segments.map((s) => s[pick]), value, other);
      return segments.map((s, i) => ({ w: widths[i] ?? 0, color: s.color })).filter((p) => p.w > 0);
    }
    const tone = pick === 'income' ? color : `color-mix(in oklch, ${color} 55%, var(--surface))`;
    return [{ w: flowWidths([value], value, other)[0] ?? 0, color: tone }].filter((p) => p.w > 0);
  };
  return [
    { label: 'Пришло', amount: signedMoney(income, currency, '+'), parts: parts(income, spending, 'income') },
    { label: 'Ушло', amount: signedMoney(spending, currency, '−'), parts: parts(spending, income, 'spending') },
  ];
});
</script>

<template>
  <div class="flex flex-col" :class="size === 'md' ? 'gap-4' : 'gap-1.5 px-1'">
    <div v-for="row in rows" :key="row.label" :class="size === 'md' ? 'flex flex-col gap-1.5' : 'flex items-center gap-2 text-xs'">
      <template v-if="size === 'md'">
        <div class="flex justify-between text-sm">
          <span class="text-foreground-secondary">{{ row.label }}</span>
          <span class="font-bold tabular-nums">{{ row.amount }}</span>
        </div>
        <div class="flex h-3 gap-0.5" aria-hidden="true">
          <div v-for="(p, i) in row.parts" :key="i" class="bg-(--c) w-(--w) last:rounded-r-md" :style="{ '--c': p.color, '--w': `${p.w}%` }" />
        </div>
      </template>
      <template v-else>
        <span class="w-11 shrink-0 text-foreground-muted">{{ row.label }}</span>
        <div class="flex h-2 grow gap-0.5" aria-hidden="true">
          <div v-for="(p, i) in row.parts" :key="i" class="bg-(--c) w-(--w) last:rounded-r-md" :style="{ '--c': p.color, '--w': `${p.w}%` }" />
        </div>
        <span class="w-21 shrink-0 text-right font-semibold tabular-nums">{{ row.amount }}</span>
      </template>
    </div>
  </div>
</template>

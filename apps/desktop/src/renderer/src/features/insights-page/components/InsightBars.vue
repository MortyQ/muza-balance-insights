<script setup lang="ts">
import { TONE_FILL } from '../constants.ts';
import type { InsightBarsView } from '../types.ts';

// A card's months: thin bars on sunken tracks, the shown month in its tone, the usual (median) as a dashed line.
const { bars, tone } = defineProps<{ bars: InsightBarsView; tone: 'up' | 'down' | 'neutral' }>();
</script>

<template>
  <figure class="flex w-full flex-col gap-1" :aria-label="bars.label" data-test="insight-bars">
    <div class="relative flex h-16 items-stretch justify-between gap-1">
      <div v-for="b in bars.bars" :key="b.key" class="flex flex-1 justify-center" :title="b.title">
        <div class="relative flex w-2 items-end rounded-full bg-surface-sunken">
          <div class="w-full rounded-full" :class="b.now ? TONE_FILL[tone] : 'bg-[color-mix(in_oklch,var(--foreground)_22%,transparent)]'" :style="{ height: `${b.height}%` }" />
        </div>
      </div>
      <div class="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground-muted" :style="{ bottom: `${bars.usual}%` }" data-test="usual-line" />
    </div>
    <div class="flex justify-between gap-1">
      <span v-for="b in bars.bars" :key="b.key" class="flex-1 text-center text-[0.6875rem] leading-none" :class="b.now ? 'font-semibold text-foreground' : 'text-foreground-muted'">{{ b.label }}</span>
    </div>
    <ul class="sr-only">
      <li v-for="b in bars.bars" :key="b.key">{{ b.title }}</li>
    </ul>
  </figure>
</template>

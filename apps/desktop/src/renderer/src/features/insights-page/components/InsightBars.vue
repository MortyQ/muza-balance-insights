<script setup lang="ts">
import { OTHER_FILL, TONE_FILL } from '../constants.ts';
import type { InsightBarsView } from '../types.ts';

// A row's months: thin bars on sunken tracks, the shown month in its tone, the usual (median) as a dashed line. It says
// what it shows (spec desktop-insights-page «The chart explains itself»): a caption and a legend of three entries.
const { bars, tone } = defineProps<{ bars: InsightBarsView; tone: 'up' | 'down' | 'neutral' }>();
</script>

<template>
  <figure class="flex w-full max-w-2xl flex-col gap-2" :aria-label="bars.label" data-test="insight-bars">
    <figcaption class="text-xs font-medium text-foreground-secondary" data-test="bars-caption">{{ $t('insights.card.chartCaption') }}</figcaption>
    <div class="flex flex-col gap-1">
      <div class="relative flex h-16 items-stretch justify-between gap-1">
        <div v-for="b in bars.bars" :key="b.key" class="flex flex-1 justify-center" :title="b.title">
          <div class="relative flex w-3 items-end rounded-full bg-surface-sunken">
            <div class="w-full rounded-full" :class="b.now ? TONE_FILL[tone] : OTHER_FILL" :style="{ height: `${b.height}%` }" />
          </div>
        </div>
        <div class="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground-muted" :style="{ bottom: `${bars.usual}%` }" data-test="usual-line" />
      </div>
      <div class="flex justify-between gap-1">
        <span v-for="b in bars.bars" :key="b.key" class="flex-1 text-center text-[0.6875rem] leading-none" :class="b.now ? 'font-semibold text-foreground' : 'text-foreground-muted'">{{ b.label }}</span>
      </div>
    </div>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted" data-test="bars-legend" aria-hidden="true">
      <li class="flex items-center gap-1.5" data-test="legend-now">
        <span class="h-3 w-1.5 rounded-full" :class="TONE_FILL[tone]" />
        {{ $t('insights.card.legend.now') }}
      </li>
      <li class="flex items-center gap-1.5" data-test="legend-other">
        <span class="h-3 w-1.5 rounded-full" :class="OTHER_FILL" />
        {{ $t('insights.card.legend.other') }}
      </li>
      <li class="flex items-center gap-1.5" data-test="legend-usual">
        <span class="w-4 border-t border-dashed border-foreground-muted" />
        {{ $t('insights.card.legend.usual', { usual: bars.usualText }) }}
      </li>
    </ul>
    <ul class="sr-only">
      <li v-for="b in bars.bars" :key="b.key">{{ b.title }}</li>
    </ul>
  </figure>
</template>

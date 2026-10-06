<script setup lang="ts">
import { computed } from 'vue';
import { VChart } from '@/shared/ui';
import type { WhenView } from '../types.ts';
import { daysChartOption, weekdaysChartOption } from '../utils.ts';

const { when } = defineProps<{ when: WhenView }>();
const weekdays = computed(() => weekdaysChartOption(when));
const days = computed(() => daysChartOption(when));
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="min-w-0 truncate text-base font-bold" :title="when.title">{{ when.title }}</h2>
      <span v-if="when.peak" class="text-xs text-foreground-secondary">{{ when.peak }}</span>
    </div>
    <div class="flex flex-wrap gap-6">
      <div class="flex min-w-40 flex-1 flex-col gap-2">
        <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('entities.operations.when.weekdays') }}</h3>
        <div class="h-28"><VChart :option="weekdays" /></div>
        <ul class="sr-only">
          <li v-for="b in when.weekdays" :key="b.key">{{ b.title }}</li>
        </ul>
      </div>
      <div class="flex min-w-56 flex-1 flex-col gap-2">
        <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('entities.operations.when.dayParts') }}</h3>
        <div v-for="p in when.dayParts" :key="p.label" class="flex items-center gap-2.5">
          <span class="w-20 shrink-0 text-xs text-foreground-secondary">{{ p.label }}</span>
          <span class="h-2 grow overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
            <span class="block h-full w-(--w) rounded-full" :class="p.strong ? 'bg-(--cat)' : 'bg-[color-mix(in_oklch,var(--cat)_45%,var(--surface))]'" :style="{ '--w': `${p.width}%` }" />
          </span>
          <span class="shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums">{{ p.amount }}</span>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-1.5">
      <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('entities.operations.when.days') }}</h3>
      <div class="h-16"><VChart :option="days" /></div>
    </div>
  </section>
</template>

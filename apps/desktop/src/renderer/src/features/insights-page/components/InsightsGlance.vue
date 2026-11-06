<script setup lang="ts">
import { VCard } from '@/shared/ui';
import { SEVERITY_FILL, TONE_TEXT } from '../constants.ts';
import type { GlanceView } from '../types.ts';

// «The month at a glance»: four figures; a running month's spending carries a meter (the usual month spent, the month
// passed); the signals figure splits by severity on one bar, each part's count named under it.
const { items } = defineProps<{ items: ReadonlyArray<GlanceView> }>();
</script>

<template>
  <div class="grid grid-cols-2 gap-3 @3xl:grid-cols-4" data-test="insights-glance">
    <VCard v-for="g in items" :key="g.key" padding="md" :data-test="`glance-${g.key}`">
      <div class="text-sm text-foreground-muted">{{ g.label }}</div>
      <div class="mt-1 text-xl font-bold tabular-nums">{{ g.value }}</div>
      <div v-if="g.meter" class="relative mt-2 h-1.5 rounded-full bg-surface-sunken" role="presentation">
        <div class="h-full rounded-full" :class="g.tone === 'up' ? 'bg-[color-mix(in_oklch,var(--series-orange)_70%,transparent)]' : 'bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)]'" :style="{ width: `${g.meter.value}%` }" />
        <div class="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground-secondary" :style="{ left: `calc(${g.meter.mark}% - 1px)` }" />
      </div>
      <template v-if="g.split">
        <div class="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="presentation" data-test="signals-bar">
          <span v-for="p in g.split" :key="p.severity" class="h-full" :class="SEVERITY_FILL[p.severity]" :style="{ flexGrow: p.count }" />
        </div>
        <ul class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-foreground-secondary">
          <li v-for="p in g.split" :key="p.severity" class="flex items-center gap-1.5" data-test="signals-count">
            <span class="size-2 shrink-0 rounded-full" :class="SEVERITY_FILL[p.severity]" aria-hidden="true" />
            {{ p.text }}
          </li>
        </ul>
      </template>
      <div v-if="g.note" class="mt-1.5 text-xs" :class="TONE_TEXT[g.tone]">{{ g.note }}</div>
    </VCard>
  </div>
</template>

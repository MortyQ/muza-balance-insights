<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import { OPS_TONE } from '../constants.ts';
import type { InsightsView } from '../types.ts';

const { insights } = defineProps<{ insights: InsightsView }>();
const ICON = { up: 'lucide:arrow-up-right', down: 'lucide:arrow-down-right', neutral: 'lucide:minus' } as const;
</script>

<template>
  <section class="flex flex-col gap-1.5 rounded-xl bg-surface-sunken px-3 py-2.5" :aria-label="$t('home.spending.insights.title')">
    <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('home.spending.insights.title') }}</h3>
    <ul class="flex flex-col gap-1">
      <li v-for="(l, i) in insights.lines" :key="i" class="flex items-start gap-1.5 text-sm">
        <VIcon :icon="ICON[l.tone]" class="mt-0.5 size-4 shrink-0" :class="OPS_TONE[l.tone]" />
        <span>{{ l.text }}</span>
      </li>
    </ul>
    <p class="text-xs text-foreground-muted">{{ insights.note }}</p>
  </section>
</template>

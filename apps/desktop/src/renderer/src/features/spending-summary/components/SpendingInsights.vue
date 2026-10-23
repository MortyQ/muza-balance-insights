<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import { OPS_TONE } from '../constants.ts';
import type { InsightsView } from '../types.ts';

const { insights } = defineProps<{ insights: InsightsView }>();
const ICON = { up: 'lucide:arrow-up-right', down: 'lucide:arrow-down-right', neutral: 'lucide:minus' } as const;
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <h3 class="text-sm font-bold">{{ $t('home.spending.insights.title') }}</h3>
    <ul class="flex flex-col gap-1.5">
      <li v-for="(l, i) in insights.lines" :key="i" class="flex items-start gap-2 rounded-lg bg-surface-sunken px-2.5 py-2 text-sm">
        <VIcon :icon="ICON[l.tone]" class="mt-0.5 size-4 shrink-0" :class="OPS_TONE[l.tone]" />
        <span>{{ l.text }}</span>
      </li>
    </ul>
    <p class="mt-auto text-xs text-foreground-muted">{{ insights.note }}</p>
  </div>
</template>

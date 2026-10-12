<script setup lang="ts">
import { VChangeChip } from '@/shared/ui';
import type { SummaryView } from '../types.ts';

const { summary, label } = defineProps<{ summary: Pick<SummaryView, 'amount' | 'chip' | 'prev' | 'note' | 'conv'>; label: string }>();
</script>

<template>
  <div class="flex min-w-56 flex-1 flex-col gap-1.5">
    <span class="text-xs font-bold uppercase tracking-wide text-foreground-muted">{{ label }}</span>
    <span class="text-4xl font-extrabold tabular-nums">{{ summary.amount }}</span>
    <span v-if="summary.chip || summary.prev" class="flex flex-wrap items-center gap-2">
      <VChangeChip v-if="summary.chip" :chip="summary.chip" size="sm" />
      <span class="text-sm text-foreground-secondary">{{ summary.prev }}</span>
    </span>
    <span v-if="summary.note || summary.conv" class="text-xs text-foreground-muted tabular-nums">{{ [summary.note, summary.conv].filter(Boolean).join(' · ') }}</span>
  </div>
</template>

<script setup lang="ts">
import type { RecurringSummaryView } from '../types.ts';

const { summary } = defineProps<{ summary: RecurringSummaryView }>();
</script>

<template>
  <div class="flex flex-col gap-1">
    <h2 class="text-base font-bold">{{ $t('recurring.title') }}</h2>
    <p class="flex flex-wrap items-baseline gap-x-2">
      <span class="text-3xl font-bold tracking-tight tabular-nums">{{ summary.total }}</span>
      <span class="text-foreground-secondary">{{ $t('recurring.perMonth') }}</span>
    </p>
    <p v-if="summary.approx" class="text-sm text-foreground-muted tabular-nums">{{ summary.approx }}</p>
    <p class="text-sm text-foreground-muted">{{ summary.count }} · {{ summary.since }}</p>
  </div>
</template>

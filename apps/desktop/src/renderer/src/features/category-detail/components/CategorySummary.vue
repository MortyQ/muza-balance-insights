<script setup lang="ts">
import { VChangeChip, VIcon } from '@/shared/ui';
import type { SummaryView } from '../types.ts';

const { summary } = defineProps<{ summary: SummaryView }>();
</script>

<template>
  <section class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--c)_16%,transparent)]" :style="{ '--c': summary.color }">
        <VIcon :icon="summary.icon" :color="summary.color" class="size-5" />
      </span>
      <div class="flex min-w-0 flex-col">
        <h1 class="truncate text-2xl font-extrabold">{{ summary.name }}</h1>
        <span class="truncate text-sm text-foreground-muted">{{ summary.subtitle }}</span>
      </div>
    </div>
    <div class="flex flex-wrap gap-x-8 gap-y-5">
      <div class="flex min-w-56 flex-1 flex-col gap-1.5">
        <span class="text-xs font-bold uppercase tracking-wide text-foreground-muted">{{ $t('category.summary.spent') }}</span>
        <span class="text-4xl font-extrabold tabular-nums">{{ summary.amount }}</span>
        <span v-if="summary.chip || summary.prev" class="flex flex-wrap items-center gap-2">
          <VChangeChip v-if="summary.chip" :chip="summary.chip" size="sm" />
          <span class="text-sm text-foreground-secondary">{{ summary.prev }}</span>
        </span>
        <span v-if="summary.gross || summary.conv" class="text-xs text-foreground-muted tabular-nums">{{ [summary.gross, summary.conv].filter(Boolean).join(' · ') }}</span>
      </div>
      <dl class="grid flex-[3_1_32rem] grid-cols-2 gap-x-6 gap-y-4 @2xl:grid-cols-3">
        <div v-for="s in summary.stats" :key="s.label" class="flex min-w-0 flex-col gap-0.5">
          <dt class="text-xs text-foreground-muted">{{ s.label }}</dt>
          <dd class="text-xl font-bold tabular-nums" :class="{ 'text-success': s.tone === 'good' }">{{ s.value }}</dd>
          <dd v-if="s.note" class="truncate text-xs text-foreground-muted" :title="s.note">{{ s.note }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

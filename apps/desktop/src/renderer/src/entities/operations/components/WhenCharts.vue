<script setup lang="ts">
import type { WhenView } from '../types.ts';

const { when } = defineProps<{ when: WhenView }>();
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
        <div class="flex h-24 items-end gap-1.5">
          <span v-for="b in when.weekdays" :key="b.key" class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" :title="b.title">
            <span class="block h-(--h) w-full rounded-t" :class="b.strong ? 'bg-(--cat)' : 'bg-[color-mix(in_oklch,var(--cat)_45%,var(--surface))]'" :style="{ '--h': `${b.height}%` }" aria-hidden="true" />
            <span class="text-[11px] text-foreground-secondary">{{ b.label }}</span>
            <span class="sr-only">{{ b.title }}</span>
          </span>
        </div>
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
      <div class="flex h-12 items-end gap-0.5" aria-hidden="true">
        <span
          v-for="b in when.days"
          :key="b.key"
          class="block min-w-0 flex-1 rounded-sm"
          :class="b.strong ? 'h-(--h) bg-(--cat)' : 'h-0.5 bg-border'"
          :style="{ '--h': `${b.height}%` }"
          :title="b.title"
        />
      </div>
      <div class="flex justify-between text-[10px] text-foreground-muted" aria-hidden="true">
        <span>1</span><span>10</span><span>20</span><span>{{ when.days.length }}</span>
      </div>
    </div>
  </section>
</template>

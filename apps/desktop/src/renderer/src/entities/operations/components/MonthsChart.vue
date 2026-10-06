<script setup lang="ts">
import type { MonthsView } from '../types.ts';

const { months, title } = defineProps<{ months: MonthsView; title: string }>();
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-base font-bold">{{ title }}</h2>
      <span v-if="months.caption" class="text-xs text-foreground-secondary">{{ months.caption }}</span>
    </div>
    <div class="relative flex h-36 items-end gap-1.5" aria-hidden="true">
      <span v-if="months.avg !== null" class="absolute inset-x-0 bottom-(--a) border-t-[1.5px] border-dashed border-foreground-muted" :style="{ '--a': `${months.avg}%` }" />
      <span v-for="b in months.bars" :key="b.key" class="flex h-full min-w-0 flex-1 items-end" :title="b.title">
        <span class="block h-(--h) w-full rounded-t-md" :class="b.strong ? 'bg-(--cat)' : 'bg-[color-mix(in_oklch,var(--cat)_45%,var(--surface))]'" :style="{ '--h': `${b.height}%` }" />
      </span>
    </div>
    <div class="flex gap-1.5 text-center text-[11px] text-foreground-muted">
      <span v-for="b in months.bars" :key="b.key" class="min-w-0 flex-1 truncate" :class="{ 'font-bold text-foreground': b.strong }">{{ b.label }}</span>
    </div>
    <ul class="sr-only">
      <li v-for="b in months.bars" :key="b.key">{{ b.title }}</li>
    </ul>
  </section>
</template>

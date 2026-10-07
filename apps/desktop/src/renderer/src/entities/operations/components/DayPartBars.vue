<script setup lang="ts">
import type { DayPartView } from '../types.ts';

const { parts } = defineProps<{ parts: ReadonlyArray<DayPartView> }>();
</script>

<template>
  <div class="flex min-w-56 flex-1 flex-col gap-2">
    <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('entities.operations.when.dayParts') }}</h3>
    <div v-for="p in parts" :key="p.label" class="flex items-center gap-2.5">
      <span class="w-20 shrink-0 text-xs text-foreground-secondary">{{ p.label }}</span>
      <span class="h-2 grow overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
        <span class="block h-full w-(--w) rounded-full" :class="p.strong ? 'bg-(--cat)' : 'bg-[color-mix(in_oklch,var(--cat)_45%,var(--surface))]'" :style="{ '--w': `${p.width}%` }" />
      </span>
      <span class="shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums">{{ p.amount }}</span>
    </div>
  </div>
</template>

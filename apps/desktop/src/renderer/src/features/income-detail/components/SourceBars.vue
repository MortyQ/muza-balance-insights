<script setup lang="ts">
import type { SourceView } from '../types.ts';

const { sources } = defineProps<{ sources: ReadonlyArray<SourceView> }>();
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-bold">{{ $t('income.sources.title') }}</h2>
    <div v-for="s in sources" :key="s.source" class="flex flex-col gap-1.5">
      <div class="flex items-center gap-2.5">
        <span class="flex min-w-0 grow flex-col">
          <span class="truncate font-semibold">{{ s.label }}</span>
          <span class="truncate text-xs text-foreground-muted">{{ s.caption }}</span>
        </span>
        <span class="shrink-0 whitespace-nowrap text-right font-bold tabular-nums">{{ s.amount }}</span>
      </div>
      <span class="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true"><span class="block h-full w-(--w) rounded-full bg-(--cat)" :style="{ '--w': `${s.width}%` }" /></span>
    </div>
  </section>
</template>

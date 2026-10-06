<script setup lang="ts">
import type { CompareRow } from '../types.ts';

const { rows } = defineProps<{ rows: ReadonlyArray<CompareRow> }>();
const GRID = 'grid grid-cols-[11rem_minmax(0,1fr)_9rem_12rem] items-center gap-4';
</script>

<template>
  <p v-if="rows.length === 0" class="text-sm text-foreground-muted">{{ $t('analytics.views.noCompare') }}</p>
  <div v-else class="overflow-x-auto">
    <div role="table" :aria-label="$t('analytics.views.compare')" class="min-w-[44rem] text-sm">
      <div role="row" :class="GRID" class="pb-1 text-xs text-foreground-muted">
        <span role="columnheader">{{ $t('analytics.views.category') }}</span>
        <span role="columnheader" class="flex justify-between"><span>{{ $t('analytics.views.fewer') }}</span><span>{{ $t('analytics.views.greater') }}</span></span>
        <span role="columnheader" class="text-right">{{ $t('analytics.views.change') }}</span>
        <span role="columnheader" class="text-right">{{ $t('analytics.views.wasNow') }}</span>
      </div>
      <div v-for="r in rows" :key="r.key" role="row" :class="GRID" class="border-t border-border-subtle py-2.5">
        <span role="rowheader" class="truncate font-semibold" :title="r.name">{{ r.name }}</span>
        <span role="cell" class="relative h-4.5" aria-hidden="true">
          <span class="absolute -inset-y-1.5 left-1/2 w-px bg-border" />
          <span
            class="absolute top-0.5 h-3.5 rounded-sm left-(--l) w-(--w)"
            :class="r.up ? 'bg-(--heat-hot)' : 'bg-(--heat-cold)'"
            :style="{ '--l': `${r.left}%`, '--w': `${r.width}%` }"
          />
        </span>
        <span role="cell" class="text-right font-semibold tabular-nums whitespace-nowrap" :class="r.up ? 'text-danger' : 'text-success'">{{ r.delta }}</span>
        <span role="cell" class="text-right text-foreground-secondary tabular-nums whitespace-nowrap">{{ r.span }}</span>
      </div>
    </div>
  </div>
</template>

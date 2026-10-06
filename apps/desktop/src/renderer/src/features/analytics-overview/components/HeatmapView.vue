<script setup lang="ts">
import type { Column, HeatRow } from '../types.ts';

const { rows, cols } = defineProps<{ rows: ReadonlyArray<HeatRow>; cols: ReadonlyArray<Column> }>();
const SWATCHES = [
  'color-mix(in oklch, var(--heat-cold) 60%, var(--surface))',
  'color-mix(in oklch, var(--heat-cold) 25%, var(--surface))',
  'var(--surface-sunken)',
  'color-mix(in oklch, var(--heat-hot) 25%, var(--surface))',
  'color-mix(in oklch, var(--heat-hot) 60%, var(--surface))',
];
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2 text-xs text-foreground-secondary" aria-hidden="true">
      <span>{{ $t('analytics.views.less') }}</span>
      <span class="flex gap-0.5">
        <span v-for="s in SWATCHES" :key="s" class="h-3 w-5 rounded-sm bg-(--swatch)" :style="{ '--swatch': s }" />
      </span>
      <span>{{ $t('analytics.views.more') }}</span>
    </div>
    <div class="overflow-x-auto">
      <div
        role="table"
        :aria-label="$t('analytics.views.heat')"
        class="grid w-max min-w-full grid-cols-[max-content_repeat(var(--cols),minmax(2.75rem,1fr))_4.5rem] gap-0.75 text-xs"
        :style="{ '--cols': cols.length }"
      >
        <div role="row" class="contents">
          <!-- A real cell (not sr-only itself): an absolutely placed item would take no grid track and shift every row. -->
          <span role="columnheader" class="sticky left-0 z-1 bg-surface"><span class="sr-only">{{ $t('analytics.views.category') }}</span></span>
          <span v-for="c in cols" :key="c.label" role="columnheader" class="pb-1 text-center whitespace-nowrap text-foreground-muted">{{ c.label }}</span>
          <span role="columnheader" class="pb-1 text-right text-foreground-muted">{{ $t('analytics.views.avg') }}</span>
        </div>
        <div v-for="r in rows" :key="r.key" role="row" class="contents">
          <span role="rowheader" class="sticky left-0 z-1 flex items-center gap-2 bg-surface pr-3 text-sm">
            <span class="size-2 shrink-0 rounded-full bg-(--dot)" :style="{ '--dot': r.color }" aria-hidden="true" />
            <span class="max-w-56 truncate" :title="r.name">{{ r.name }}</span>
          </span>
          <span
            v-for="(c, j) in r.cells"
            :key="j"
            role="cell"
            :title="c.title"
            class="grid h-8.5 place-items-center rounded-md bg-(--cell) tabular-nums"
            :class="{ 'font-bold': c.strong, 'outline-1 -outline-offset-1 outline-dashed outline-border-strong': c.running }"
            :style="{ '--cell': c.background }"
          >
            {{ c.text }}
          </span>
          <span role="cell" class="grid place-items-center justify-end text-foreground-secondary tabular-nums">{{ r.avg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

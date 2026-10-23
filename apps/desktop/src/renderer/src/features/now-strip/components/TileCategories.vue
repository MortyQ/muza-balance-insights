<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { CategoryRow } from '../types.ts';

const { rows } = defineProps<{ rows: ReadonlyArray<CategoryRow> }>();
</script>

<template>
  <!-- A tile's short list: the category's icon in a soft circle of its colour, the name, a bar against the period's
       biggest category, the amount. -->
  <ul class="flex flex-col gap-2" data-test="tile-categories">
    <li v-for="r in rows" :key="r.key" class="grid grid-cols-[1.5rem_minmax(0,6rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm" :style="{ '--c': r.color }">
      <span class="grid size-6 place-items-center rounded-full bg-[color-mix(in_oklch,var(--c)_16%,transparent)] text-(--c)" aria-hidden="true">
        <VIcon :icon="r.icon" :size="13" />
      </span>
      <span class="truncate" :title="r.name">{{ r.name }}</span>
      <span class="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
        <span class="block h-full w-(--w) rounded-full bg-(--c)" :style="{ '--w': `${Math.max(3, r.bar)}%` }" />
      </span>
      <span class="text-right font-semibold whitespace-nowrap tabular-nums">{{ r.amount }}</span>
    </li>
  </ul>
</template>

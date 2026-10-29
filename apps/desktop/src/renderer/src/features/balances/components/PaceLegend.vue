<script setup lang="ts">
import type { MoneyFormat } from '@/entities/currency-display';
import type { PaceLegendItem } from '../types.ts';

const { items, fmt } = defineProps<{ items: ReadonlyArray<PaceLegendItem>; fmt: Readonly<MoneyFormat> }>();
</script>

<template>
  <!-- The pace by banks (spec desktop-spending-split): which colour is which bank, and its part so far. -->
  <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs" data-test="pace-legend">
    <li v-for="item in items" :key="item.provider" class="inline-flex items-center gap-1.5">
      <span class="size-2.5 rounded-full bg-(--swatch)" :style="{ '--swatch': item.swatch }" aria-hidden="true" />
      <span class="text-foreground-muted">{{ item.name }}</span>
      <span class="font-semibold tabular-nums">{{ fmt.money(item.amount) }}</span>
    </li>
  </ul>
</template>

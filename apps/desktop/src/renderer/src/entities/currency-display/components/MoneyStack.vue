<script setup lang="ts">
// An amount in the main currency with one quiet line under it per picked «Show also» currency (spec
// desktop-currency-display). Every listed amount goes through it, so the extra currencies look the same everywhere.
const { amount, also = [], align = 'end', strong = true } = defineProps<{
  amount: string;
  also?: ReadonlyArray<string>;
  align?: 'start' | 'end';
  /** The figure in bold (rows); false — the surrounding weight. */
  strong?: boolean;
}>();
</script>

<template>
  <span class="flex shrink-0 flex-col gap-px" :class="align === 'end' ? 'items-end text-right' : 'items-start'" data-test="money-stack">
    <span class="whitespace-nowrap tabular-nums" :class="{ 'font-bold': strong }"><slot>{{ amount }}</slot></span>
    <span v-for="c in also" :key="c" class="whitespace-nowrap text-xs font-normal text-foreground-muted tabular-nums" data-test="money-also">{{ c }}</span>
  </span>
</template>

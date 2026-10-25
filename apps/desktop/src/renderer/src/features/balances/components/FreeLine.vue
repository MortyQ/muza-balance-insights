<script setup lang="ts">
import type { FreeLineView } from '../types.ts';

const { line } = defineProps<{ line: Readonly<FreeLineView> }>();
</script>

<template>
  <!-- Under the stack: what the card in front leaves free to spend and its reserve. The bar: the free part (accent) and
       the reserve (hatched); when the reserves are more than the money, the part they cover (soft red) and the rest
       uncovered (hatched soft red), with the free amount below zero in soft red. -->
  <div class="flex flex-col gap-1.5" data-test="free-line">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p class="flex items-baseline gap-2">
        <span class="text-sm text-foreground-muted">{{ $t('home.balances.freeLine.free') }}</span>
        <span class="text-xl font-bold tabular-nums" :class="line.negative ? 'text-negative-soft' : 'text-primary'" data-test="free-amount">{{ line.free }}</span>
      </p>
      <span v-if="line.reserved" class="text-sm text-foreground-muted tabular-nums">{{ $t('home.balances.freeLine.reservedAmount', { amount: line.reserved }) }}</span>
    </div>
    <div
      v-if="line.share !== null"
      class="h-1.5 overflow-hidden rounded-full"
      :class="
        line.short
          ? 'bg-[repeating-linear-gradient(135deg,var(--negative-soft-bg)_0_4px,color-mix(in_oklch,var(--negative-soft)_45%,transparent)_4px_7px)]'
          : 'bg-[repeating-linear-gradient(135deg,var(--surface-sunken)_0_4px,var(--border)_4px_7px)]'
      "
      aria-hidden="true"
      data-test="free-bar"
    >
      <div class="h-full w-(--w) rounded-full" :class="line.short ? 'bg-negative-soft' : 'bg-primary'" :style="{ '--w': `${line.share}%` }" />
    </div>
  </div>
</template>

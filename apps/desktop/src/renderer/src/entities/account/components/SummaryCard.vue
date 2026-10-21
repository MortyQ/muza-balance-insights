<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/shared/lib';
import { VIcon } from '@/shared/ui';
import type { SummaryCardProps } from '../types.ts';

const { title, caption, count, amount, approx, negative, own, reserved, net, accents, dim } = defineProps<SummaryCardProps>();
defineEmits<{ click: [] }>();

const mix = (color: string, share: string) => `color-mix(in oklch, ${color} var(${share}), var(--surface))`;

/** The header band: the people's colours side by side; one person's colour fades out. */
const band = computed(() => {
  if (accents.length === 0) return 'none';
  const stops = accents.length === 1 ? [mix(accents[0]!, '--card-band-tint'), mix(accents[0]!, '--card-band-fade')] : accents.map((c) => mix(c, '--card-band-tint'));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
});

type Tile = { key: string; label: string; amount: string; tone: 'neutral' | 'minus' | 'up' | 'down'; arrow: 'up' | 'down' | null };
/** Own funds and the reserved amount with reserves only, then the month's net. */
const tiles = computed<Tile[]>(() => [
  ...(own ? [{ key: 'own', label: t('home.balances.actualTile'), amount: own.amount, tone: own.negative ? 'minus' : 'neutral', arrow: null } as const] : []),
  ...(reserved !== null ? [{ key: 'reserved', label: t('home.balances.reserved'), amount: reserved, tone: 'neutral', arrow: null } as const] : []),
  ...(net ? [{ key: 'net', label: net.label, amount: net.amount, tone: net.value < 0 ? 'down' : 'up', arrow: net.value < 0 ? 'down' : 'up' } as const] : []),
]);
const COLUMNS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'] as const;
const TILE = {
  neutral: { box: 'bg-surface-sunken', label: 'text-foreground-muted', value: '' },
  minus: { box: 'bg-surface-sunken', label: 'text-foreground-muted', value: 'text-negative-soft' },
  up: { box: 'bg-success-subtle', label: 'text-success', value: 'text-success' },
  down: { box: 'bg-negative-soft-bg', label: 'text-negative-soft', value: 'text-negative-soft' },
} as const;
</script>

<template>
  <!-- The total of a view, not a card of a bank: a header band in the people's colours, the figures as tiles. -->
  <button
    type="button"
    class="relative flex h-[252px] w-[400px] shrink-0 flex-col overflow-hidden rounded-[18px] border border-border bg-surface text-left text-foreground shadow-md
           transition-[transform,box-shadow] duration-450 ease-[cubic-bezier(.34,1.8,.64,1)] hover:-translate-y-[3px] hover:shadow-lg
           active:scale-[.97] active:duration-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-border-focus
           motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    :class="{ 'opacity-55': dim }"
    @click="$emit('click')"
  >
    <span data-test="band" class="flex h-11 shrink-0 items-center justify-between gap-3 bg-(image:--band) px-4" :style="{ '--band': band }">
      <span class="flex min-w-0 items-center gap-2">
        <VIcon icon="lucide:layers" :size="14" class="shrink-0" />
        <span class="truncate text-[15px] font-bold">{{ title }}</span>
        <span class="shrink-0 rounded-full bg-surface/75 px-1.5 text-xs font-semibold text-foreground-secondary">{{ $t('home.balances.total') }}</span>
      </span>
      <span class="flex shrink-0 -space-x-1" aria-hidden="true">
        <span
          v-for="(color, i) in accents"
          :key="i"
          data-test="dot"
          class="size-2.5 rounded-full bg-(--accent) ring-2 ring-surface"
          :style="{ '--accent': color }"
        />
      </span>
    </span>
    <span class="flex flex-1 flex-col justify-between px-3 pt-2.5 pb-3">
      <span class="flex flex-col gap-0.5 px-1">
        <span class="flex justify-between gap-3 text-xs text-foreground-muted">
          <span class="truncate font-semibold">{{ caption }}</span>
          <span class="truncate" :title="count">{{ count }}</span>
        </span>
        <span class="flex items-baseline justify-between gap-3">
          <span data-test="amount" class="text-[32px] leading-tight font-extrabold tracking-tight whitespace-nowrap tabular-nums" :class="{ 'text-negative-soft': negative }">
            {{ amount }}
          </span>
          <span v-if="approx" class="truncate text-xs text-foreground-muted tabular-nums" :title="approx">{{ approx }}</span>
        </span>
      </span>
      <span v-if="tiles.length" class="grid gap-1.5" :class="COLUMNS[tiles.length]">
        <span v-for="tile in tiles" :key="tile.key" :data-test="`tile-${tile.key}`" class="flex min-w-0 flex-col rounded-[10px] px-2.5 py-1.5" :class="TILE[tile.tone].box">
          <span class="truncate text-xs" :class="TILE[tile.tone].label">{{ tile.label }}</span>
          <span class="flex items-center gap-0.5 text-sm font-bold tabular-nums" :class="TILE[tile.tone].value">
            <VIcon v-if="tile.arrow" :icon="tile.arrow === 'down' ? 'lucide:arrow-down-right' : 'lucide:arrow-up-right'" :size="14" class="shrink-0" />
            <span class="truncate" :title="tile.amount">{{ tile.amount }}</span>
          </span>
        </span>
      </span>
    </span>
  </button>
</template>

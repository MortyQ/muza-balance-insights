<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/shared/lib';
import { VIcon } from '@/shared/ui';
import type { SummaryCardProps } from '../types.ts';

const { title, caption, count, amount, fx, negative, own, reserved, people, freeShare, net, accents, dim } = defineProps<SummaryCardProps>();
defineEmits<{ click: [] }>();

const mix = (color: string, share: string) => `color-mix(in oklch, ${color} var(${share}), var(--surface))`;

/** The header band: the people's colours side by side; one person's colour fades out. */
const band = computed(() => {
  if (accents.length === 0) return 'none';
  const stops = accents.length === 1 ? [mix(accents[0]!, '--card-band-tint'), mix(accents[0]!, '--card-band-fade')] : accents.map((c) => mix(c, '--card-band-tint'));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
});

/** The header shows this many dots; the rest go into «+N». */
const DOTS = 5;
const dots = computed(() => accents.slice(0, DOTS));
const moreDots = computed(() => (accents.length > DOTS ? t('home.balances.morePeople', { n: accents.length - DOTS }) : ''));

/** A part of the shares bar: the person's colour, a minus hatched in it. */
const partFill = (color: string, value: number) =>
  value > 0 ? color : `repeating-linear-gradient(135deg, color-mix(in oklch, ${color} 55%, var(--surface)) 0 3px, var(--surface) 3px 5px)`;

type Tile = { key: string; label: string; amount: string; tone: 'neutral' | 'minus' | 'up' | 'down'; arrow: 'up' | 'down' | null };
/** The month's net: green above zero, soft red below, neutral and without an arrow at zero. */
const netTile = (n: NonNullable<SummaryCardProps['net']>): Tile => {
  const sign = Math.sign(n.value);
  return { key: 'net', label: n.label, amount: n.amount, tone: sign > 0 ? 'up' : sign < 0 ? 'down' : 'neutral', arrow: sign > 0 ? 'up' : sign < 0 ? 'down' : null };
};
/** Own funds and the reserved amount with reserves only, then the month's net. */
const tiles = computed<Tile[]>(() => [
  ...(own ? [{ key: 'own', label: t('home.balances.actualTile'), amount: own.amount, tone: own.negative ? 'minus' : 'neutral', arrow: null } as const] : []),
  ...(reserved !== null ? [{ key: 'reserved', label: t('home.balances.reserved'), amount: reserved, tone: 'neutral', arrow: null } as const] : []),
  ...(net ? [netTile(net)] : []),
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
  <!-- The total of a view, not a card of a bank: a header band in the people's colours, the conversions in a column,
       the people's shares or the reserve meter in the middle, the figures as tiles. -->
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
      <span class="flex shrink-0 items-center" aria-hidden="true">
        <span class="flex -space-x-1">
          <span
            v-for="(color, i) in dots"
            :key="i"
            data-test="dot"
            class="size-2.5 rounded-full bg-(--accent) ring-2 ring-surface"
            :style="{ '--accent': color }"
          />
        </span>
        <span v-if="moreDots" data-test="more-dots" class="ml-1.5 text-[11px] font-bold text-foreground-secondary">{{ moreDots }}</span>
      </span>
    </span>
    <span class="flex min-h-0 flex-1 flex-col justify-between px-3 pt-2.5 pb-3">
      <span class="flex min-h-0 flex-1 gap-4 px-1 pb-2.5">
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="truncate text-xs font-semibold text-foreground-muted">{{ caption }}</span>
          <span data-test="amount" class="truncate text-[32px] leading-tight font-extrabold tracking-tight tabular-nums" :class="{ 'text-negative-soft': negative }" :title="amount">
            {{ amount }}
          </span>
          <span class="truncate text-xs text-foreground-muted" :title="count">{{ count }}</span>
          <span v-if="people" data-test="shares" class="mt-auto flex flex-col gap-1.5">
            <span v-if="people.parts.length" class="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              <span
                v-for="(part, i) in people.parts"
                :key="i"
                data-test="share-part"
                class="min-w-1 basis-0"
                :class="part.value > 0 ? 'bg-(--part)' : 'bg-(image:--part)'"
                :style="{ flexGrow: Math.abs(part.value), '--part': partFill(part.color, part.value) }"
              />
            </span>
            <span class="flex min-w-0 items-center gap-2.5 text-[11px] text-foreground-muted" :title="people.all">
              <span v-for="(p, i) in people.items" :key="i" data-test="share" class="flex min-w-0 items-center gap-1 whitespace-nowrap">
                <span class="size-[7px] shrink-0 rounded-full bg-(--accent)" :style="{ '--accent': p.color }" />
                <span class="truncate">{{ p.name }}</span>
                <span class="shrink-0 font-bold tabular-nums" :class="p.negative ? 'text-negative-soft' : 'text-foreground'">{{ p.amount }}</span>
              </span>
              <span v-if="people.more" data-test="share-more" class="shrink-0 rounded-full bg-surface-sunken px-1.5 font-bold text-foreground-secondary">{{ people.more }}</span>
            </span>
          </span>
          <span v-else-if="freeShare !== null" data-test="meter" class="mt-auto flex flex-col gap-1.5">
            <span class="flex h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
              <span data-test="meter-free" class="rounded-full bg-foreground/80" :style="{ width: `${freeShare}%` }" />
            </span>
            <span class="flex justify-between gap-2 text-[11px] text-foreground-muted">
              <span class="truncate">{{ $t('home.balances.freeShare', { pct: freeShare }) }}</span>
              <span class="truncate">{{ $t('home.balances.reservedShare', { pct: 100 - freeShare }) }}</span>
            </span>
          </span>
        </span>
        <span v-if="fx.length" data-test="fx" class="flex shrink-0 flex-col justify-center gap-2 border-l border-border-subtle pl-4">
          <span class="text-[11px] text-foreground-muted">{{ $t('home.balances.atRate') }}</span>
          <span v-for="row in fx" :key="row.code" data-test="fx-row" class="flex items-center gap-2">
            <span class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-bold text-foreground-secondary">{{ row.symbol }}</span>
            <span class="flex flex-col leading-tight">
              <span class="text-[15px] font-bold tabular-nums" :class="{ 'text-negative-soft': negative }">{{ row.amount }}</span>
              <span class="text-[11px] text-foreground-muted">{{ row.code }}</span>
            </span>
          </span>
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

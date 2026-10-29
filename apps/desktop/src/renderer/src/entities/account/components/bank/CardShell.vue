<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { CardTone, CardFigures } from '../../types.ts';

// The body every bank's card shares (spec desktop-balance-cards): a physical card's size and parts — the wordmark
// (slot `brand`), the chip and the contactless mark, a soft sheen — and the figures. The skin paints the card with its
// root classes and the `art` slot (shapes under the content); `tone` says whether the card is dark or light.
const { title, caption, amount, approx, actual, bottom, net, netText, accents, dim, tone = 'dark' } = defineProps<
  Omit<CardFigures, 'variant'> & { tone?: CardTone }
>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="relative flex h-[252px] w-[400px] shrink-0 flex-col justify-between overflow-hidden rounded-[18px] p-5 text-left shadow-md
           ring-1 ring-black/5 ring-inset
           transition-[transform,box-shadow] duration-450 ease-[cubic-bezier(.34,1.8,.64,1)] hover:-translate-y-[3px] hover:shadow-lg
           active:scale-[.97] active:duration-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-border-focus
           motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    :class="[tone === 'light' ? 'text-[#16171c]' : 'text-white', { 'opacity-55': dim }]"
    :data-tone="tone"
    @click="$emit('click')"
  >
    <span class="pointer-events-none absolute inset-0" aria-hidden="true"><slot name="art" /></span>
    <!-- The sheen: light falling across the card from the top left. -->
    <span
      class="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/.16)_0%,rgb(255_255_255/0)_38%,rgb(255_255_255/0)_70%,rgb(255_255_255/.06)_100%)]"
      aria-hidden="true"
    />
    <span class="relative flex items-start justify-between gap-3">
      <span class="flex min-h-6 items-center" aria-hidden="true"><slot name="brand" /></span>
      <span v-if="accents.length > 0" class="flex gap-1" aria-hidden="true" data-test="card-dots">
        <span
          v-for="(color, i) in accents"
          :key="i"
          class="size-3 rounded-full bg-(--accent) ring-2"
          :class="tone === 'light' ? 'ring-black/10' : 'ring-white/25'"
          :style="{ '--accent': color }"
        />
      </span>
    </span>
    <span class="relative flex items-center gap-2" aria-hidden="true">
      <!-- The chip: a gold plate with its contact lines. -->
      <span
        class="relative h-[26px] w-9 overflow-hidden rounded-[5px] bg-[linear-gradient(135deg,#e9d18b,#c9a64e_45%,#f1dea0_70%,#b8913f)]
               shadow-[inset_0_0_0_1px_rgb(0_0_0/.18)]"
        data-test="card-chip"
      >
        <span class="absolute inset-x-0 top-1/2 h-px bg-black/25" />
        <span class="absolute inset-y-0 left-1/3 w-px bg-black/25" />
        <span class="absolute inset-y-0 right-1/3 w-px bg-black/25" />
      </span>
      <VIcon icon="lucide:nfc" class="size-5 rotate-90" :class="tone === 'light' ? 'text-black/45' : 'text-white/70'" />
    </span>
    <span class="relative flex flex-col gap-1">
      <span class="text-sm" :class="tone === 'light' ? 'text-black/60' : 'text-white/65'">{{ caption }}</span>
      <span class="text-[28px] leading-none font-bold tracking-tight tabular-nums">{{ amount }}</span>
      <span v-if="approx" class="text-sm tabular-nums" :class="tone === 'light' ? 'text-black/60' : 'text-white/65'">{{ approx }}</span>
      <span v-if="actual" class="text-sm tabular-nums" :class="tone === 'light' ? 'text-black/60' : 'text-white/65'">{{ actual }}</span>
    </span>
    <span class="relative flex items-end justify-between gap-3 text-sm">
      <span class="flex min-w-0 flex-col">
        <span class="truncate font-semibold">{{ title }}</span>
        <span class="truncate text-xs" :class="tone === 'light' ? 'text-black/60' : 'text-white/70'">{{ bottom }}</span>
      </span>
      <span v-if="net !== null" class="inline-flex shrink-0 items-center gap-1 tabular-nums">
        <VIcon
          :icon="net < 0 ? 'lucide:arrow-down-right' : 'lucide:arrow-up-right'"
          :color="tone === 'light' ? (net < 0 ? 'var(--card-down-ink)' : 'var(--card-up-ink)') : net < 0 ? 'var(--card-down)' : 'var(--card-up)'"
        />
        <span class="font-bold">{{ netText }}</span>
      </span>
    </span>
  </button>
</template>

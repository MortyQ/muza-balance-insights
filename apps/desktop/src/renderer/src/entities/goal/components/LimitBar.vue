<script setup lang="ts">
import { computed } from 'vue';
import { STATE_LOOK, type StateLookName } from '../constants.ts';

// A limit's bar: spent of the amount on a sunken track, coloured by the state, and the pace marker — where the pace
// allows by today. Past the limit the track is the scale of what was spent: the limit's part solid, the part above it
// hatched, a tick at the limit. Hidden from screen readers: the same figures are beside it as text.
const { fill, over = 0, pace = null, state, color = null, thick = false } = defineProps<{
  /** The filled share of the track, %; past the limit — the limit's share of the scale. */
  fill: number;
  /** The share of the track above the limit, % (hatched); 0 — not exceeded. */
  over?: number;
  pace?: number | null;
  state: StateLookName;
  /** The fill while on track (a category's colour); else the state's. */
  color?: string | null;
  thick?: boolean;
}>();
const fillColor = computed(() => ((state === 'ok' || state === 'ahead') && color ? color : STATE_LOOK[state].fill));
const hatch = computed(() => `repeating-linear-gradient(45deg, color-mix(in oklab, ${fillColor.value} 55%, transparent) 0 3px, transparent 3px 6px)`);
</script>

<template>
  <div class="relative rounded-full bg-surface-sunken" :class="thick ? 'h-3' : 'h-2'" aria-hidden="true" data-test="limit-bar">
    <div class="absolute inset-y-0 left-0" :class="over > 0 ? 'rounded-l-full' : 'rounded-full'" :style="{ width: `${fill}%`, background: fillColor }" />
    <div
      v-if="over > 0"
      class="absolute inset-y-0 right-0 rounded-r-full"
      :style="{ width: `${over}%`, background: hatch }"
      data-test="limit-over"
    />
    <div v-if="over > 0" class="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" :style="{ left: `${fill}%` }" data-test="limit-tick" />
    <div
      v-if="pace !== null"
      class="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/55"
      :style="{ left: `${pace}%` }"
      data-test="pace-marker"
    />
  </div>
</template>

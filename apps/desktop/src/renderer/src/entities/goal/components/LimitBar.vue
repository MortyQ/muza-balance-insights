<script setup lang="ts">
import { computed } from 'vue';
import type { LimitStateName } from '@contract/api.ts';
import { STATE_LOOK } from '../constants.ts';

// A limit's bar: spent of the amount on a sunken track, coloured by the state, and the pace marker — where the pace
// allows by today. Hidden from screen readers: the same figures are beside it as text.
const { fill, pace = null, state, color = null, thick = false } = defineProps<{
  fill: number;
  pace?: number | null;
  state: LimitStateName;
  /** The fill while on track (a category's colour); else the state's. */
  color?: string | null;
  thick?: boolean;
}>();
const fillColor = computed(() => (state === 'ok' && color ? color : STATE_LOOK[state].fill));
</script>

<template>
  <div class="relative rounded-full bg-surface-sunken" :class="thick ? 'h-3' : 'h-2'" aria-hidden="true" data-test="limit-bar">
    <div class="absolute inset-y-0 left-0 rounded-full" :style="{ width: `${fill}%`, background: fillColor }" />
    <div
      v-if="pace !== null"
      class="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/55"
      :style="{ left: `${pace}%` }"
      data-test="pace-marker"
    />
  </div>
</template>

<!-- Ours, not copied: muzakit's VMeter reads a value against a threshold (state icon, label); this is a plain share of
     a whole — a category, a person, a source, a part of the day — beside its own text, so it is hidden from screen
     readers. One fill or coloured segments in one bar, an optional mark (where the value stood before). -->
<script setup lang="ts">
import { computed } from "vue";

export interface ShareBarSegment {
  /** Weight inside the filled part (flex-grow), any scale. */
  value: number;
  color: string;
  title?: string;
}

const {
  value,
  color = "var(--ui-primary)",
  segments = null,
  mark = null,
  markTitle = undefined,
  size = "md",
  track = true,
} = defineProps<{
  /** The filled part, % of the bar (clamped to 0–100). */
  value: number;
  /** One fill's CSS colour (without `segments`). */
  color?: string;
  /** Coloured parts of the filled part instead of one fill. */
  segments?: ReadonlyArray<ShareBarSegment> | null;
  /** A mark at this % of the bar; null — none. */
  mark?: number | null;
  markTitle?: string;
  size?: "xs" | "sm" | "md";
  /** The grey track under the fill. */
  track?: boolean;
}>();

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const parts = computed<ReadonlyArray<ShareBarSegment>>(() => segments ?? [{ value: 1, color }]);
</script>

<template>
  <span class="v-share-bar" :class="[`v-share-bar--${size}`, { 'v-share-bar--track': track }]" aria-hidden="true">
    <span class="v-share-bar__fill" :style="{ '--v-share-bar-width': `${clamp(value)}%` }">
      <span
        v-for="(p, i) in parts"
        :key="i"
        class="v-share-bar__part"
        :style="{ '--v-share-bar-grow': p.value, '--v-share-bar-color': p.color }"
        :title="p.title"
      />
    </span>
    <span v-if="mark !== null" class="v-share-bar__mark" :style="{ '--v-share-bar-mark': `${clamp(mark)}%` }" :title="markTitle" />
  </span>
</template>

<style lang="scss" scoped>
@use "../../styles/components/feedback/vsharebar.scss";
</style>

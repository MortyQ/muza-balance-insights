<!-- Ours, not copied: muzakit has no change chip. A change against a base («+9%», «+1 090 ₴», «as in August»):
     orange = more, blue = less, never red / green; the sign and the arrow carry the direction, `sr` says it to screen
     readers when the text alone does not. Used by the spending block and the now strip. -->
<script setup lang="ts">
import VIcon from "../base/VIcon.vue";

export interface ChangeChipModel {
  text: string;
  tone: "up" | "down" | "neutral";
  arrow: "up" | "down" | null;
  /** Screen-reader-only direction ('' — the text says it). */
  sr: string;
  title?: string;
}

const { chip, size = "md" } = defineProps<{ chip: ChangeChipModel; size?: "sm" | "md" }>();
</script>

<template>
  <span class="v-change-chip" :class="[`v-change-chip--${chip.tone}`, `v-change-chip--${size}`]" :title="chip.title">
    <VIcon v-if="chip.arrow" :icon="chip.arrow === 'up' ? 'lucide:arrow-up-right' : 'lucide:arrow-down-right'" class="v-change-chip__icon" />
    {{ chip.text }}
    <span v-if="chip.sr" class="v-change-chip__sr">{{ chip.sr }}</span>
  </span>
</template>

<style lang="scss" scoped>
@use "../../styles/components/feedback/vchangechip.scss";
</style>

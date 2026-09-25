<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script lang="ts" setup>
import { computed } from "vue";

import VIcon from "../base/VIcon.vue";

const {
  percentage,
  step = null,
  size = "md",
  showPercentage = true,
} = defineProps<{
  /** Progress percentage (0-100), values outside the range are clamped */
  percentage: number
  /** Current step/status text */
  step?: string | null
  size?: "sm" | "md" | "lg"
  showPercentage?: boolean
}>();

const clampedPercentage = computed(() => Math.max(0, Math.min(100, percentage)));

const isCompleted = computed(() => clampedPercentage.value >= 100);

const rootClass = computed(() => [
  `v-progress-bar--${size}`,
  { "v-progress-bar--completed": isCompleted.value },
]);
</script>

<template>
  <div
    :class="rootClass"
    :style="{ '--v-progress-value': `${clampedPercentage}%` }"
    class="v-progress-bar"
  >
    <div
      v-if="step || showPercentage"
      class="v-progress-bar__header"
    >
      <span
        v-if="step"
        class="v-progress-bar__step"
      >
        {{ step }}
      </span>
      <span v-else />

      <div
        v-if="showPercentage"
        class="v-progress-bar__percentage"
      >
        <span>{{ Math.round(clampedPercentage) }}%</span>
        <VIcon
          v-if="isCompleted"
          :size="14"
          icon="lucide:check-circle"
        />
      </div>
    </div>

    <div
      :aria-valuenow="Math.round(clampedPercentage)"
      aria-valuemax="100"
      aria-valuemin="0"
      class="v-progress-bar__track"
      role="progressbar"
    >
      <div class="v-progress-bar__fill">
        <div
          v-if="!isCompleted"
          class="v-progress-bar__shine"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "../../styles/components/feedback/vprogressbar.scss";
</style>

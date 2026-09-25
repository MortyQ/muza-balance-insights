<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script lang="ts" setup>

export type LoaderVariant = "primary" | "secondary" | "success" | "warning" | "danger" | "info";

interface Props {
  size?: "sm" | "md" | "lg"
  message?: string
  fullscreen?: boolean
  /** Spinner tone; defaults to primary */
  variant?: LoaderVariant
}

const {
  size = "md",
  message = undefined,
  fullscreen = false,
  variant = undefined,
} = defineProps<Props>();
</script>

<template>
  <div
    :class="{ 'v-loader--fullscreen': fullscreen }"
    aria-label="Loading"
    class="v-loader-container"
    role="status"
  >
    <div
      :class="[`v-loader--${size}`, variant && `v-loader--${variant}`]"
      class="v-loader"
    />

    <slot>
      <span
        v-if="message"
        class="v-loader-message"
      >{{ message }}</span>
    </slot>
  </div>
</template>

<style scoped>
@import "../../styles/components/feedback/vloader.scss";
</style>

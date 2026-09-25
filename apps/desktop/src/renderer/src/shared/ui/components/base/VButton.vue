<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script lang="ts" setup>
import { computed, inject } from "vue";

import { BUTTON_GROUP_KEY } from "./injectionKeys";
import VIcon from "./VIcon.vue";

const {
  text = "",
  type = "button",
  variant = "primary",
  icon = undefined,
  disabled = false,
  loading = false,
  size = undefined,
} = defineProps<{
  text?: string
  type?: "button" | "submit" | "reset"
  disabled?: boolean
  loading?: boolean
  icon?: string
  /**
   * Six tonal hues plus one filled tier. `default` is an alias for `primary`,
   * kept so a call site ported from the original codebase resolves the same way.
   */
  variant?:
    | "default" | "primary" | "secondary" | "positive" | "negative" | "warning" | "link"
    /** Tonal secondary. */
    | "neutral"
    /** Informational accent. */
    | "info"
  /**
   * 28 / 32 / 40px. Left unset the button keeps the chrome's natural 30px, so
   * adding this prop cannot reflow anything on its own.
   */
  size?: "sm" | "md" | "lg"
}>();

const slots = defineSlots();

/** Set only when this button is a cell of a `VButtonGroup`. */
const isGrouped = inject(BUTTON_GROUP_KEY, false);

const isIconOnly = computed(() => !text && !!icon && !slots.default);
const isDisabled = computed(() => disabled || loading);

// "default" is an alias for the primary look, matching the original codebase, where the
// variant switch falls through to primary.
const variantClass = computed(() =>
  `v-button--${variant === "default" ? "primary" : variant}`,
);

/** VIcon's own default is 24, which leaves no room in a 30px button. */
const iconSize = 15;

const rootClass = computed(() => ({
  "v-button--icon-only": isIconOnly.value,
  [variantClass.value]: true,
  // Two classes, not one: both block input, but only `disabled` dims. A
  // loading button is busy with what was just asked of it, not unavailable.
  "v-button--disabled": disabled,
  "v-button--loading": loading && !disabled,
  "v-button--grouped": isGrouped,
  ...(size ? { [`v-button--${size}`]: true } : {}),
}));

const rootAttrs = computed(() => ({
  type,
  disabled: isDisabled.value,
  "aria-busy": loading || undefined,
}));
</script>

<template>
  <button
    :class="rootClass"
    class="v-button"
    v-bind="rootAttrs"
  >
    <span
      v-if="$slots.iconLeft || loading || icon"
      class="v-button__icon v-button__icon--left"
    >
      <slot name="iconLeft">
        <VIcon
          :icon="icon"
          :loading="loading"
          :size="iconSize"
        />
      </slot>
    </span>

    <span
      v-if="!isIconOnly"
      class="v-button__label"
    >
      <slot>{{ text }}</slot>
    </span>

    <span
      v-if="$slots.iconRight"
      class="v-button__icon v-button__icon--right"
    >
      <slot name="iconRight" />
    </span>
  </button>
</template>

<style lang="scss" scoped>
@use "../../styles/components/base/vbutton.scss";
</style>

<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script lang="ts" setup>
import { type VNode, computed } from "vue";

import VIcon from "../base/VIcon.vue";
import VLoader from "../feedback/VLoader.vue";

export type CardSize = "fit" | "sm" | "md" | "lg" | "xl" | "full";
export type CardVariant
  = | "default" | "elevated" | "outlined" | "ghost"
    | "glass" | "glass-elevated" | "translucent";
export type CardRadius = "none" | "sm" | "md" | "lg" | "xl" | "full";
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

type CardProps = {
  // Content
  title?: string
  subtitle?: string
  description?: string
  /** Iconify icon rendered before the title */
  icon?: string

  // Appearance
  variant?: CardVariant
  size?: CardSize
  radius?: CardRadius
  padding?: CardPadding

  // States
  loading?: boolean
  disabled?: boolean
  /** Renders as interactive even without href — pair with @click */
  clickable?: boolean

  /** Element to render; ignored when href is set, which forces an anchor */
  as?: string
  href?: string
  target?: "_blank" | "_self" | "_parent" | "_top"
};

type CardSlots = {
  default?: () => VNode[]
  header?: () => VNode[]
  footer?: () => VNode[]
  loading?: () => VNode[]
};

const {
  title = "",
  subtitle = "",
  description = "",
  icon = "",
  variant = "default",
  size = "full",
  radius = "xl",
  padding = "sm",
  loading = false,
  disabled = false,
  clickable = false,
  as = "div",
  href = "",
  target = "_self",
} = defineProps<CardProps>();

const emit = defineEmits<{ click: [event: MouseEvent] }>();

const slots = defineSlots<CardSlots>();

const hasHeader = computed(() => !!(title || subtitle || icon || slots.header));
const hasFooter = computed(() => !!slots.footer);

const isInteractive = computed(() => clickable || !!href || as === "button");

const componentTag = computed(() => (href ? "a" : as));

const linkAttrs = computed(() => {
  if (!href) return {};

  return {
    href,
    target,
    rel: target === "_blank" ? "noopener noreferrer" : undefined,
  };
});

const cardClasses = computed(() => [
  "v-card",
  `v-card--${variant}`,
  `v-card--${size}`,
  `v-card--radius-${radius}`,
  `v-card--padding-${padding}`,
  disabled && "v-card--disabled",
  loading && "v-card--loading",
  isInteractive.value && "v-card--interactive",
]);

const handleClick = (event: MouseEvent): void => {
  if (disabled || loading) {
    event.preventDefault();
    return;
  }

  emit("click", event);
};
</script>

<template>
  <component
    :is="componentTag"
    :class="cardClasses"
    v-bind="linkAttrs"
    @click="handleClick"
  >
    <div
      v-if="loading"
      class="v-card__loading"
    >
      <slot name="loading">
        <VLoader />
      </slot>
    </div>

    <template v-else>
      <header
        v-if="hasHeader"
        class="v-card__header"
      >
        <slot name="header">
          <div class="v-card__header-content">
            <VIcon
              v-if="icon"
              :icon="icon"
              class="v-card__icon"
            />

            <div
              v-if="title || subtitle"
              class="v-card__header-text"
            >
              <h3
                v-if="title"
                class="v-card__title"
              >
                {{ title }}
              </h3>
              <p
                v-if="subtitle"
                class="v-card__subtitle"
              >
                {{ subtitle }}
              </p>
            </div>
          </div>

          <p
            v-if="description"
            class="v-card__description"
          >
            {{ description }}
          </p>
        </slot>
      </header>

      <div
        v-if="slots.default"
        class="v-card__content"
      >
        <slot />
      </div>

      <footer
        v-if="hasFooter"
        class="v-card__footer"
      >
        <slot name="footer" />
      </footer>
    </template>
  </component>
</template>

<style scoped>
@import "../../styles/components/layout/vcard.scss";
</style>

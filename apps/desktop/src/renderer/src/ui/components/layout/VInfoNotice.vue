<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script lang="ts" setup>
import { computed } from "vue";

import VIcon from "../base/VIcon.vue";

import VCard from "./VCard.vue";

export type NoticeTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

export interface NoticeFeature {
  icon: string
  title: string
  description?: string
  tone?: NoticeTone
}

const {
  icon = "lucide:info",
  tone = "primary",
  title = undefined,
  subtitle = undefined,
  card = true,
  size = 20,
  features = undefined,
  hint = undefined,
} = defineProps<{
  /** Lucide icon name */
  icon?: string
  /** Colour of the leading icon */
  tone?: NoticeTone
  title?: string
  subtitle?: string
  /** Wrap the notice in a VCard */
  card?: boolean
  /** Leading icon size in pixels */
  size?: number
  /** Renders the compact feature-grid layout instead of the default one */
  features?: ReadonlyArray<NoticeFeature>
  /** Footnote rendered under a separator, with an info icon */
  hint?: string
}>();

const hasFeatures = computed(() => !!features && features.length > 0);

const toneClass = (value: NoticeTone = "primary"): string => `v-info-notice--tone-${value}`;
</script>

<template>
  <component
    :is="card ? VCard : 'div'"
    class="v-info-notice"
  >
    <div
      v-if="hasFeatures"
      class="v-info-notice__stack"
    >
      <div
        v-if="title || subtitle || $slots.title || $slots.subtitle"
        class="v-info-notice__head"
      >
        <slot name="icon">
          <span
            :class="toneClass(tone)"
            class="v-info-notice__icon"
          >
            <VIcon
              :icon="icon"
              :size="20"
            />
          </span>
        </slot>

        <div class="v-info-notice__head-text">
          <p
            v-if="title || $slots.title"
            class="v-info-notice__title"
          >
            <slot name="title">
              {{ title }}
            </slot>
          </p>
          <p
            v-if="subtitle || $slots.subtitle"
            class="v-info-notice__subtitle"
          >
            <slot name="subtitle">
              {{ subtitle }}
            </slot>
          </p>
        </div>
      </div>

      <div class="v-info-notice__features">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="v-info-notice__feature"
        >
          <span
            :class="toneClass(feature.tone)"
            class="v-info-notice__feature-icon"
          >
            <VIcon
              :icon="feature.icon"
              :size="16"
            />
          </span>

          <div class="v-info-notice__feature-text">
            <p class="v-info-notice__feature-title">
              {{ feature.title }}
            </p>
            <p
              v-if="feature.description"
              class="v-info-notice__feature-description"
            >
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="hint || $slots.hint"
        class="v-info-notice__hint"
      >
        <VIcon
          :size="14"
          icon="lucide:info"
        />
        <span><slot name="hint">{{ hint }}</slot></span>
      </div>
    </div>

    <div
      v-else
      class="v-info-notice__head"
    >
      <slot name="icon">
        <span
          :class="toneClass(tone)"
          class="v-info-notice__icon"
        >
          <VIcon
            :icon="icon"
            :size="size"
          />
        </span>
      </slot>

      <div class="v-info-notice__body">
        <p
          v-if="title || $slots.title"
          class="v-info-notice__title"
        >
          <slot name="title">
            {{ title }}
          </slot>
        </p>

        <p
          v-if="subtitle || $slots.subtitle"
          class="v-info-notice__subtitle"
        >
          <slot name="subtitle">
            {{ subtitle }}
          </slot>
        </p>

        <div
          v-if="$slots.default"
          class="v-info-notice__subtitle"
        >
          <slot />
        </div>
      </div>

      <div
        v-if="$slots.actions"
        class="v-info-notice__actions"
      >
        <slot name="actions" />
      </div>
    </div>
  </component>
</template>

<style scoped>
@import "../../styles/components/layout/vinfonotice.scss";
</style>

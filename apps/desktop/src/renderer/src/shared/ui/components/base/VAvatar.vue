<!-- copied from muzakit/libs/ui/src (2026-10-07); changes: ui/README.md -->
<script lang="ts" setup>
import { computed, ref, watch } from "vue";

const {
  name = "",
  avatar = undefined,
  size = "md",
  customSize = undefined,
  shape = "circle",
  online = false,
  alt = "",
  color = undefined,
} = defineProps<{
  /** User name, used for the initials fallback and the deterministic tone */
  name?: string
  /** Avatar image URL */
  avatar?: string
  /** Size preset */
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  /** Explicit size in pixels, overrides the preset */
  customSize?: number
  shape?: "circle" | "square"
  /** Show the online status dot */
  online?: boolean
  /** Decorative by default: the name is beside the avatar. */
  alt?: string
  /** A CSS colour for the initials' background (a person's colour); replaces the name's tone. */
  color?: string
}>();

const AVATAR_TONE_COUNT = 8;

const imageFailed = ref(false);

watch(() => avatar, () => {
  imageFailed.value = false;
});

const hasAvatar = computed(() => !!avatar && !imageFailed.value);

// One letter: people here are named by one word («Olya», «Ivan»).
const initials = computed(() => (name.trim().slice(0, 1) || "?").toLocaleUpperCase("uk"));

/** Stable per-name tone so the same user always gets the same colour */
const toneIndex = computed(() => {
  if (!name || color) return null;

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return Math.abs(hash) % AVATAR_TONE_COUNT;
});

const rootClass = computed(() => [
  `v-avatar--${size}`,
  `v-avatar--${shape}`,
  {
    [`v-avatar--tone-${toneIndex.value}`]: !hasAvatar.value && toneIndex.value !== null,
    "v-avatar--color": !hasAvatar.value && !!color,
    "v-avatar--empty": !hasAvatar.value && toneIndex.value === null && !color,
  },
]);

const rootStyle = computed(() => ({
  ...(customSize ? { "--v-avatar-size": `${customSize}px` } : {}),
  ...(color ? { "--v-avatar-color": color } : {}),
}));
</script>

<template>
  <span
    :class="rootClass"
    :style="rootStyle"
    class="v-avatar"
  >
    <img
      v-if="hasAvatar"
      :alt="alt"
      :src="avatar"
      class="v-avatar__image"
      @error="imageFailed = true"
    >

    <span
      v-else
      class="v-avatar__initials"
    >
      {{ initials }}
    </span>

    <span
      v-if="online"
      aria-hidden="true"
      class="v-avatar__status"
    />
  </span>
</template>

<style lang="scss" scoped>
@use "../../styles/components/base/vavatar.scss";
</style>

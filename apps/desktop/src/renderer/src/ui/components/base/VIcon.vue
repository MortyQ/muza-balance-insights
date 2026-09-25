<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script lang="ts" setup>
import { computed } from "vue";

import { ICONS } from "./icons";

const {
  icon = "",
  size = 24,
  color = undefined,
  loading = false,
} = defineProps<{
  icon?: string
  size?: string | number
  /**
   * Any CSS colour value, e.g. "var(--ui-primary)". Omit to inherit
   * currentColor from the parent, which is the usual way to tone an icon.
   *
   * Deliberately not accepting a Tailwind class as so-platform does: a class
   * name assembled at runtime is invisible to the v4 scanner, so the utility
   * is never generated and the colour silently does nothing.
   */
  color?: string
  loading?: boolean
}>();

const resolvedIcon = computed(() =>
  loading ? "lucide:loader-circle" : icon,
);

const iconSize = computed(() =>
  typeof size === "number" ? size : parseInt(size),
);

// Build-time registry in place of @iconify/vue, which would download unknown icons from
// api.iconify.design. An unknown name renders nothing (and warns in dev).
const component = computed(() => {
  const found = ICONS[resolvedIcon.value];
  if (!found && resolvedIcon.value && import.meta.env.DEV) {
    console.warn(`[VIcon] "${resolvedIcon.value}" is not in ui/components/base/icons.ts`);
  }
  return found;
});
</script>

<template>
  <component
    :is="component"
    v-if="component"
    :class="{ 'v-icon--spin': loading }"
    :height="iconSize"
    :style="color ? { color } : undefined"
    :width="iconSize"
    aria-hidden="true"
    class="v-icon"
    focusable="false"
  />
</template>

<style scoped>
.v-icon {
  display: inline-flex;
  flex-shrink: 0;
  line-height: 1;
}

.v-icon--spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

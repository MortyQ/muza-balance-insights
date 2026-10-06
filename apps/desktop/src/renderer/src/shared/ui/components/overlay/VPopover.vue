<!-- built on reka-ui (2026-10-02): Popover. Ours, not copied: muzakit has no popover or dropdown menu.
     An icon trigger (label → aria-label), optionally with visible text before the icon (the label must contain it),
     and a panel for any content; Esc and a click outside close it. -->
<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import VIcon from "../base/VIcon.vue";

const { icon, label, text = "", align = "end" } = defineProps<{
  icon: string;
  /** The trigger's accessible name; with `text` it must contain that text (WCAG «label in name»). */
  label: string;
  /** Visible text before the icon: a filter-like trigger (the currency switch). */
  text?: string;
  align?: "start" | "center" | "end";
}>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-popover__trigger" :class="{ 'v-popover__trigger--text': text }" :aria-label="label">
      <span v-if="text" class="v-popover__text">{{ text }}</span>
      <VIcon :icon class="v-popover__icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent as-child :align :side-offset="6">
        <div class="v-popover__content">
          <slot />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/overlay/vpopover.scss";
</style>

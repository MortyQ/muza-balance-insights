<!-- built on reka-ui (2026-10-02): Popover. Ours, not copied: muzakit has no popover or dropdown menu.
     An icon-only trigger (label → aria-label) and a panel for any content; Esc and a click outside close it. -->
<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import VIcon from "../base/VIcon.vue";

const { icon, label, align = "end" } = defineProps<{
  icon: string;
  /** The trigger's accessible name (it shows the icon only). */
  label: string;
  align?: "start" | "center" | "end";
}>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-popover__trigger" :aria-label="label">
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

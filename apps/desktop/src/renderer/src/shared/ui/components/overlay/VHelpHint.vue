<!-- Ours, not copied (2026-11-01; muzakit has no inline help): a small «?» next to a figure that opens a short
     explanation on reka-ui's Popover — what the figure means, the formula in words and with the user's numbers.
     The trigger's accessible name is `label`; the panel holds a `title` and any content. Esc and a click outside close it. -->
<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import VIcon from "../base/VIcon.vue";

const { label, title = "" } = defineProps<{
  /** The trigger's accessible name: «How «Per day» is counted». */
  label: string;
  title?: string;
}>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-help-hint__trigger" :aria-label="label">
      <VIcon icon="lucide:circle-question-mark" class="v-help-hint__icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent as-child align="start" :side-offset="6">
        <div class="v-help-hint__content">
          <p v-if="title" class="v-help-hint__title">{{ title }}</p>
          <div class="v-help-hint__body"><slot /></div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/overlay/vhelphint.scss";
</style>

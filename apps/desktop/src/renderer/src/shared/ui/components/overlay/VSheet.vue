<!-- built on reka-ui (2026-10-26): Dialog. Ours, not copied: muzakit has no drawer or sheet.
     A modal panel at the window's right edge (a bottom sheet below 45rem) over the current screen: focus stays inside,
     Esc and the scrim close it, focus returns to what opened it. A title, the content and a footer for its actions. -->
<script setup lang="ts">
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";

const { title, description = "" } = defineProps<{
  title: string;
  description?: string;
}>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="v-sheet__scrim" />
      <DialogContent class="v-sheet" :aria-describedby="description ? undefined : ''">
        <header class="v-sheet__header">
          <DialogTitle class="v-sheet__title">{{ title }}</DialogTitle>
          <DialogDescription v-if="description" class="v-sheet__description">{{ description }}</DialogDescription>
        </header>
        <div class="v-sheet__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="v-sheet__footer">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/overlay/vsheet.scss";
</style>

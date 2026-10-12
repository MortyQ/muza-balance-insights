<script setup lang="ts">
const { title, hint, labelFor, nested = false } = defineProps<{
  title: string;
  hint?: string;
  /** The control's id: the title and hint become its label (a switch toggles from the whole text). */
  labelFor?: string;
  /** A row that belongs to the row above it (a switch's own options): indented and set back. */
  nested?: boolean;
}>();
</script>

<template>
  <div class="flex min-h-13 flex-wrap items-center justify-between gap-4 px-4 py-3" :class="{ 'bg-surface-raised pl-8': nested }">
    <component :is="labelFor ? 'label' : 'div'" :for="labelFor" class="flex min-w-0 flex-col gap-0.5" :class="{ 'cursor-pointer': labelFor }">
      <span class="font-semibold">{{ title }}</span>
      <span v-if="hint || $slots.hint" class="text-sm text-foreground-muted"><slot name="hint">{{ hint }}</slot></span>
    </component>
    <slot />
  </div>
</template>

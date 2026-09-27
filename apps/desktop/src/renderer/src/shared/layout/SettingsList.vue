<script setup lang="ts">
const { heading } = defineProps<{ heading?: string }>();
</script>

<template>
  <h3 v-if="heading" class="mt-2 text-xs font-semibold text-foreground-secondary">{{ heading }}</h3>
  <div class="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm [&>*+*]:border-t [&>*+*]:border-border-subtle">
    <slot />
  </div>
</template>

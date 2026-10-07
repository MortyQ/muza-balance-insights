<script setup lang="ts">
const { amount, conv } = defineProps<{ amount: string; conv: ReadonlyArray<string> }>();
</script>

<template>
  <span class="flex w-25 shrink-0 flex-col items-end gap-px">
    <span class="whitespace-nowrap font-bold tabular-nums">{{ amount }}</span>
    <span v-for="c in conv" :key="c" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ c }}</span>
  </span>
</template>

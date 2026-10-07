<script setup lang="ts">
import { VIcon } from '@/shared/ui';

const { name, icon, color, subtitle } = defineProps<{ name: string; icon: string; color: string; subtitle: string }>();
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--c)_16%,transparent)]" :style="{ '--c': color }">
      <VIcon :icon :color class="size-5" />
    </span>
    <div class="flex min-w-0 flex-col">
      <h1 class="truncate text-2xl font-extrabold">{{ name }}</h1>
      <span class="truncate text-sm text-foreground-muted">{{ subtitle }}</span>
    </div>
  </div>
</template>

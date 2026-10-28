<script setup lang="ts">
import { VShareBar } from '@/shared/ui';
import type { PartView } from '../types.ts';

const { part } = defineProps<{ part: PartView }>();
defineSlots<{ mark(props: { part: PartView }): unknown }>();
</script>

<template>
  <div class="flex flex-col gap-1.5" :style="{ '--c': part.color }">
    <div class="flex items-center gap-2.5">
      <slot name="mark" :part />
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate font-semibold" :title="part.name">{{ part.name }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ part.caption }}</span>
      </span>
      <span class="shrink-0 whitespace-nowrap text-right font-bold tabular-nums">{{ part.amount }}</span>
    </div>
    <VShareBar :value="part.width" color="var(--c)" />
  </div>
</template>

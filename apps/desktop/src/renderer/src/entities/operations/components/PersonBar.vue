<script setup lang="ts">
import { VShareBar } from '@/shared/ui';
import type { PersonView } from '../types.ts';

const { person } = defineProps<{ person: PersonView }>();
</script>

<template>
  <div class="flex flex-col gap-1.5" :style="{ '--c': person.color }">
    <div class="flex items-center gap-2.5">
      <span class="grid size-6.5 shrink-0 place-items-center rounded-full bg-(--c) text-xs font-extrabold text-white" aria-hidden="true">{{ person.initial }}</span>
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate font-semibold" :title="person.name">{{ person.name }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ person.caption }}</span>
      </span>
      <span class="shrink-0 whitespace-nowrap text-right font-bold tabular-nums">{{ person.amount }}</span>
    </div>
    <VShareBar :value="person.width" color="var(--c)" />
  </div>
</template>

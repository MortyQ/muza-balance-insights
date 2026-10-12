<script setup lang="ts">
import { VAvatar, VShareBar } from '@/shared/ui';
import type { PersonView } from '../types.ts';

const { person } = defineProps<{ person: PersonView }>();
</script>

<template>
  <div class="flex flex-col gap-1.5" :style="{ '--c': person.color }">
    <div class="flex items-center gap-2.5">
      <VAvatar :name="person.name" :color="person.color" size="sm" :custom-size="26" aria-hidden="true" />
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate font-semibold" :title="person.name">{{ person.name }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ person.caption }}</span>
      </span>
      <span class="shrink-0 whitespace-nowrap text-right font-bold tabular-nums">{{ person.amount }}</span>
    </div>
    <VShareBar :value="person.width" color="var(--c)" />
  </div>
</template>

<script setup lang="ts">
import type { PersonView } from '../types.ts';

const { people } = defineProps<{ people: ReadonlyArray<PersonView> }>();
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-bold">{{ $t('category.who.title') }}</h2>
    <div v-for="p in people" :key="p.participantId" class="flex flex-col gap-1.5" :style="{ '--c': p.color }">
      <div class="flex items-center gap-2.5">
        <span class="grid size-6.5 shrink-0 place-items-center rounded-full bg-(--c) text-xs font-extrabold text-white" aria-hidden="true">{{ p.initial }}</span>
        <span class="min-w-0 grow truncate font-semibold">{{ p.name }}</span>
        <span class="shrink-0 text-xs text-foreground-muted">{{ p.caption }}</span>
        <span class="w-24 shrink-0 text-right font-bold tabular-nums">{{ p.amount }}</span>
      </div>
      <span class="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true"><span class="block h-full w-(--w) rounded-full bg-(--c)" :style="{ '--w': `${p.width}%` }" /></span>
    </div>
  </section>
</template>

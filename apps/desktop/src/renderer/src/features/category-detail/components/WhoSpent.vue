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
        <span class="flex min-w-0 grow flex-col">
          <span class="truncate font-semibold" :title="p.name">{{ p.name }}</span>
          <span class="truncate text-xs text-foreground-muted">{{ p.caption }}</span>
        </span>
        <span class="shrink-0 whitespace-nowrap text-right font-bold tabular-nums">{{ p.amount }}</span>
      </div>
      <span class="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true"><span class="block h-full w-(--w) rounded-full bg-(--c)" :style="{ '--w': `${p.width}%` }" /></span>
    </div>
  </section>
</template>

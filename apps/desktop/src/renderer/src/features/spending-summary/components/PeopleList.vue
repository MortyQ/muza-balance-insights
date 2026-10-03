<script setup lang="ts">
import type { PersonRowView } from '../types.ts';
import ChangeChip from './ChangeChip.vue';

const { rows } = defineProps<{ rows: ReadonlyArray<PersonRowView> }>();
const emit = defineEmits<{ pick: [participantId: number | null] }>();
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <button
      v-for="r in rows"
      :key="r.participantId ?? 'family'"
      type="button"
      :aria-pressed="r.pressed"
      class="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-border-focus"
      :class="r.pressed ? 'bg-surface-raised ring-[1.5px] ring-(--c)' : 'hover:bg-surface-hover'"
      :style="{ '--c': r.participantId === null ? 'var(--border-strong)' : r.color }"
      @click="emit('pick', r.participantId)"
    >
      <span v-if="r.participantId === null" class="flex w-7 shrink-0 ps-1" aria-hidden="true">
        <span v-for="(d, i) in r.dots" :key="i" class="-ms-1 size-3 rounded-full bg-(--d) ring-2 ring-surface" :style="{ '--d': d }" />
      </span>
      <span v-else class="grid size-7 shrink-0 place-items-center rounded-full bg-(--c) text-base font-extrabold text-white" aria-hidden="true">{{ r.initial }}</span>
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate font-semibold" :title="r.name">{{ r.name }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ r.caption }}</span>
      </span>
      <span class="flex shrink-0 flex-col items-end gap-0.5">
        <span class="whitespace-nowrap font-bold tabular-nums">{{ r.amount }}</span>
        <ChangeChip v-if="r.chip" :chip="r.chip" size="sm" />
      </span>
    </button>
  </div>
</template>

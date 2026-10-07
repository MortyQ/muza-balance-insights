<script setup lang="ts">
import { VAvatar, VChangeChip } from '@/shared/ui';
import type { PersonRowView } from '../../types.ts';

const { row } = defineProps<{ row: PersonRowView }>();
const emit = defineEmits<{ pick: [participantId: number | null] }>();
</script>

<template>
  <button
    type="button"
    :aria-pressed="row.pressed"
    class="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-border-focus"
    :class="row.pressed ? 'bg-surface-raised ring-[1.5px] ring-(--c)' : 'hover:bg-surface-hover'"
    :style="{ '--c': row.participantId === null ? 'var(--border-strong)' : row.color }"
    @click="emit('pick', row.participantId)"
  >
    <!-- «Whole family»: every person's colour. -->
    <span v-if="row.participantId === null" class="flex w-7 shrink-0 ps-1" aria-hidden="true">
      <span v-for="(d, i) in row.dots" :key="i" class="-ms-1 size-3 rounded-full bg-(--d) ring-2 ring-surface" :style="{ '--d': d }" />
    </span>
    <VAvatar v-else :name="row.name" :color="row.color" size="lg" :custom-size="28" aria-hidden="true" />
    <span class="flex min-w-0 grow flex-col">
      <span class="truncate font-semibold" :title="row.name">{{ row.name }}</span>
      <span class="truncate text-xs text-foreground-muted">{{ row.caption }}</span>
    </span>
    <span class="flex shrink-0 flex-col items-end gap-0.5">
      <span class="whitespace-nowrap font-bold tabular-nums">{{ row.amount }}</span>
      <VChangeChip v-if="row.chip" :chip="row.chip" size="sm" />
    </span>
  </button>
</template>

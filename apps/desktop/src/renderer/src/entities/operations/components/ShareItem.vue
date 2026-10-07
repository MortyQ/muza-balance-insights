<script setup lang="ts">
import type { ShareItemView } from '../types.ts';

const { item } = defineProps<{ item: ShareItemView }>();
const emit = defineEmits<{ pick: [key: string] }>();
</script>

<template>
  <button
    type="button"
    :aria-pressed="item.pressed"
    class="flex min-h-11 cursor-pointer flex-col gap-1.5 rounded-xl px-3 py-2 text-left ring-inset focus-visible:outline-2 focus-visible:outline-border-focus"
    :class="item.pressed ? 'bg-primary-subtle ring-[1.5px] ring-primary' : 'hover:bg-surface-hover'"
    @click="emit('pick', item.key)"
  >
    <span class="flex w-full items-center gap-2.5">
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate font-semibold" :title="item.name">{{ item.name }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ item.caption }}</span>
      </span>
      <span class="shrink-0 whitespace-nowrap text-right font-bold tabular-nums">{{ item.amount }}</span>
    </span>
    <span class="block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
      <span class="block h-full w-(--w) rounded-full bg-(--cat)" :style="{ '--w': `${item.width}%` }" />
    </span>
  </button>
</template>

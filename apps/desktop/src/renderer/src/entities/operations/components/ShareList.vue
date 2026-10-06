<script setup lang="ts">
import type { ShareItemView } from '../types.ts';

const { items, more, title } = defineProps<{ items: ReadonlyArray<ShareItemView>; more: string; title: string }>();
const emit = defineEmits<{ pick: [key: string] }>();
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-base font-bold">{{ title }}</h2>
      <span class="text-xs text-foreground-muted">{{ $t('entities.operations.filterHint') }}</span>
    </div>
    <button
      v-for="m in items"
      :key="m.key"
      type="button"
      :aria-pressed="m.pressed"
      class="flex min-h-11 cursor-pointer flex-col gap-1.5 rounded-xl px-3 py-2 text-left ring-inset focus-visible:outline-2 focus-visible:outline-border-focus"
      :class="m.pressed ? 'bg-primary-subtle ring-[1.5px] ring-primary' : 'hover:bg-surface-hover'"
      @click="emit('pick', m.key)"
    >
      <span class="flex w-full items-center gap-2.5">
        <span class="flex min-w-0 grow flex-col">
          <span class="truncate font-semibold" :title="m.name">{{ m.name }}</span>
          <span class="truncate text-xs text-foreground-muted">{{ m.caption }}</span>
        </span>
        <span class="shrink-0 whitespace-nowrap text-right font-bold tabular-nums">{{ m.amount }}</span>
      </span>
      <span class="block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
        <span class="block h-full w-(--w) rounded-full bg-(--cat)" :style="{ '--w': `${m.width}%` }" />
      </span>
    </button>
    <p v-if="more" class="px-3 text-xs text-foreground-muted">{{ more }}</p>
  </section>
</template>

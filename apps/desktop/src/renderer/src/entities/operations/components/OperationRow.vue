<script setup lang="ts">
import { OPERATION_COLS } from '../constants.ts';
import type { LineRowView, MarkView } from '../types.ts';

const { row } = defineProps<{ row: LineRowView }>();
const MARK_TONE: Record<MarkView['tone'], string> = {
  warning: 'bg-warning-subtle text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))]',
  good: 'bg-success-subtle text-success',
  neutral: 'bg-surface-sunken text-foreground-secondary',
  accent: 'bg-primary-subtle text-primary',
};
</script>

<template>
  <div role="row" :class="OPERATION_COLS" class="items-center border-b border-border-subtle px-3 py-2.5 hover:bg-surface-raised">
    <span role="cell" class="flex flex-col">
      <span class="font-semibold">{{ row.date }}</span>
      <span class="text-xs text-foreground-muted">{{ row.time }}</span>
    </span>
    <span role="cell" class="flex min-w-0 flex-col">
      <span class="truncate font-semibold" :title="row.merchant">{{ row.merchant }}</span>
      <span v-if="row.comment" class="truncate text-xs italic text-foreground-muted" :title="row.comment">{{ row.comment }}</span>
    </span>
    <span role="cell" class="flex min-w-0 items-center gap-2">
      <span v-if="row.person" class="size-2 shrink-0 rounded-full bg-(--c)" :style="{ '--c': row.personColor }" aria-hidden="true" />
      <span class="flex min-w-0 flex-col">
        <span v-if="row.person" class="truncate">{{ row.person }}</span>
        <span class="truncate text-xs text-foreground-muted" :title="row.account">{{ row.account }}</span>
      </span>
    </span>
    <span role="cell" class="flex flex-wrap gap-1">
      <span v-for="m in row.marks" :key="m.text" class="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" :class="MARK_TONE[m.tone]">{{ m.text }}</span>
    </span>
    <span role="cell" class="flex flex-col items-end">
      <span class="whitespace-nowrap font-bold tabular-nums" :class="{ 'text-success': row.incoming }">{{ row.amount }}</span>
      <span v-if="row.original" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ row.original }}</span>
    </span>
  </div>
</template>

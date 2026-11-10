<script setup lang="ts">
import { VContextMenu, VMenu, VTooltip } from '@/shared/ui';
import { operationCols } from '../constants.ts';
import type { LineRowView, MarkView } from '../types.ts';

const { row, withActions = false, withMarks = true } = defineProps<{
  row: LineRowView;
  /** The list has a menu column: the row keeps its cell, empty when the row has no menu. */
  withActions?: boolean;
  /** The list has a marks column (some shown row has a mark). */
  withMarks?: boolean;
}>();
const emit = defineEmits<{ action: [key: string, id: string] }>();
const MARK_TONE: Record<MarkView['tone'], string> = {
  warning: 'bg-warning-subtle text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))]',
  good: 'bg-success-subtle text-success',
  neutral: 'bg-surface-sunken text-foreground-secondary',
  accent: 'bg-primary-subtle text-primary',
};
</script>

<template>
  <VContextMenu :items="row.actions ?? []" @select="(id) => emit('action', row.key, id)">
    <div role="row" :class="operationCols(withActions, withMarks)" class="items-center border-b border-border-subtle px-3 py-2.5 hover:bg-surface-raised">
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
      <span v-if="withMarks" role="cell" class="flex flex-wrap gap-1">
        <template v-for="m in row.marks" :key="m.text">
          <VTooltip v-if="m.hint" :text="m.hint" placement="top" tabindex="0" wrapper-class="inline-flex" data-test="mark-hint">
            <span class="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" :class="MARK_TONE[m.tone]">{{ m.text }}<span class="sr-only">: {{ m.hint }}</span></span>
          </VTooltip>
          <span v-else class="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" :class="MARK_TONE[m.tone]">{{ m.text }}</span>
        </template>
      </span>
      <span role="cell" class="flex flex-col items-end">
        <span class="whitespace-nowrap font-bold tabular-nums" :class="{ 'text-success': row.incoming }">{{ row.amount }}</span>
        <span v-for="c in row.also ?? []" :key="c" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums" data-test="money-also">{{ c }}</span>
        <span v-if="row.original" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ row.original }}</span>
      </span>
      <span v-if="withActions" role="cell" class="flex justify-end">
        <VMenu
          v-if="row.actions?.length"
          :items="row.actions"
          :label="$t('entities.operations.list.actions', { name: row.merchant })"
          @select="(id) => emit('action', row.key, id)"
        />
      </span>
    </div>
  </VContextMenu>
</template>

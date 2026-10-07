<script setup lang="ts">
import { VAvatar, VIcon } from '@/shared/ui';
import type { RecurringRowView } from '../types.ts';

const { row } = defineProps<{ row: RecurringRowView }>();
</script>

<template>
  <li class="flex min-h-14 items-center gap-3 py-2">
    <span class="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-foreground-secondary" aria-hidden="true">
      <VIcon :icon="row.icon" class="size-4.5" />
    </span>
    <span class="flex min-w-0 grow flex-col">
      <span class="truncate font-semibold" :title="row.name">{{ row.name }}</span>
      <span class="flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted">
        <VAvatar v-if="row.person" :name="row.person.name" :color="row.person.color" size="sm" :custom-size="16" aria-hidden="true" />
        <span class="truncate">{{ row.caption }}</span>
      </span>
    </span>
    <span class="flex shrink-0 flex-col items-end gap-0.5">
      <span class="whitespace-nowrap font-bold tabular-nums">{{ row.amount }}</span>
      <span v-if="row.operation" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ row.operation }}</span>
      <span class="whitespace-nowrap text-xs text-foreground-muted">{{ row.when }}</span>
    </span>
  </li>
</template>

<script setup lang="ts">
import { LimitBar, LimitStateChip, PendingNote } from '@/entities/goal';
import { VButton, VHelpHint, VIcon } from '@/shared/ui';
import type { LimitRowView } from '../types.ts';

const { row } = defineProps<{ row: LimitRowView }>();
const emit = defineEmits<{ edit: [] }>();
</script>

<template>
  <li class="flex flex-col gap-1.5 py-3" data-test="limit-row">
    <div class="flex items-center gap-3">
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken">
        <VIcon :icon="row.icon" class="size-4 text-foreground-secondary" />
      </span>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate font-semibold">{{ row.name }}</span>
        <span class="text-xs text-foreground-muted">{{ row.periodText }}<template v-if="row.owner"> · {{ row.owner }}</template></span>
      </div>
      <span v-if="row.look" class="shrink-0 font-semibold tabular-nums">{{ row.look.spentOf }}</span>
      <VButton variant="link" size="sm" :text="$t('limits.edit')" data-test="limit-edit" @click="emit('edit')" />
    </div>
    <template v-if="row.look">
      <LimitBar :fill="row.look.fill" :pace="row.look.pace" :state="row.look.state" />
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted tabular-nums">
        <LimitStateChip :state="row.look.state" :text="row.look.stateText" />
        <span v-if="row.look.paceText">{{ row.look.paceText }}</span>
        <span class="flex items-center gap-1">
          {{ $t('limits.perDay', { amount: row.look.perDay }) }}
          <VHelpHint :label="row.look.help.perDay.title" :title="row.look.help.perDay.title">
            <p v-for="(line, i) in row.look.help.perDay.lines" :key="i">{{ line }}</p>
          </VHelpHint>
        </span>
        <PendingNote v-if="row.look.pending" :note="row.look.pending" />
      </div>
    </template>
    <p v-else class="text-xs text-foreground-muted">{{ $t('limits.noRate') }}</p>
  </li>
</template>

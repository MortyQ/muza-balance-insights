<script setup lang="ts">
import { VButton, VHelpHint } from '@/shared/ui';
import type { GoalRowView } from '../types.ts';

// A savings goal: a ring of its progress, the money of the target and its source, what is needed a month to its date.
const { row } = defineProps<{ row: GoalRowView }>();
const emit = defineEmits<{ edit: [] }>();
const R = 18;
const C = 2 * Math.PI * R;
</script>

<template>
  <li class="flex items-center gap-3 py-3" data-test="goal-row">
    <svg viewBox="0 0 44 44" class="size-11 shrink-0" aria-hidden="true">
      <circle cx="22" cy="22" :r="R" fill="none" stroke="var(--surface-sunken)" stroke-width="5" />
      <circle
        v-if="row.percent !== null"
        cx="22" cy="22" :r="R" fill="none" stroke-width="5" stroke-linecap="round" transform="rotate(-90 22 22)"
        :stroke="row.tone === 'met' ? 'var(--success)' : 'var(--kind-left)'"
        :stroke-dasharray="`${(row.percent / 100) * C} ${C}`"
      />
    </svg>
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate font-semibold">{{ row.name }}<template v-if="row.owner"> · <span class="font-normal text-foreground-muted">{{ row.owner }}</span></template></span>
      <span class="text-sm tabular-nums text-foreground-secondary">{{ row.progress }}<template v-if="row.percent !== null"> · {{ row.percent }}%</template></span>
      <span v-if="row.need" class="flex items-center gap-1 text-xs tabular-nums" :class="row.tone === 'late' ? 'text-danger' : row.tone === 'met' ? 'text-success' : 'text-foreground-muted'" data-test="goal-need">
        {{ row.need }}
        <VHelpHint v-if="row.help" :label="row.help.title" :title="row.help.title">
          <p v-for="(line, i) in row.help.lines" :key="i">{{ line }}</p>
        </VHelpHint>
      </span>
    </div>
    <VButton variant="link" size="sm" :text="$t('limits.edit')" data-test="goal-edit" @click="emit('edit')" />
  </li>
</template>

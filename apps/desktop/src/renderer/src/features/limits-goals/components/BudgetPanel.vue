<script setup lang="ts">
import { LimitBar, LimitStateChip, PendingNote } from '@/entities/goal';
import { VButton, VCard, VHelpHint, VIcon } from '@/shared/ui';
import type { BudgetPanelView } from '../types.ts';

// The monthly budget on top of the «Budget» screen: the total, the fixed rows paid or not, and the flexible part with
// its bar, pace marker, state, forecast and per day — or, for a past month, the result.
const { panel } = defineProps<{ panel: BudgetPanelView }>();
const emit = defineEmits<{ edit: [] }>();
const PAID_ICON = { yes: 'lucide:check', part: 'lucide:clock', no: 'lucide:minus' } as const;
</script>

<template>
  <VCard padding="md" data-test="budget-panel">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="text-base font-bold">{{ panel.title }} · <span class="tabular-nums">{{ panel.total }}</span></h2>
          <VHelpHint :label="panel.help.title" :title="panel.help.title">
            <p v-for="(line, i) in panel.help.lines" :key="i">{{ line }}</p>
          </VHelpHint>
        </div>
        <VButton variant="link" size="sm" :text="$t('limits.edit')" data-test="budget-edit" @click="emit('edit')" />
      </div>
      <div class="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
        <section class="flex min-w-0 flex-col gap-2" :aria-label="$t('limits.budget.fixedTitle')">
          <p class="text-xs text-foreground-muted tabular-nums">{{ $t('limits.budget.fixedTitle') }} · {{ panel.fixedSummary }}</p>
          <ul v-if="panel.fixed.length > 0" class="flex flex-col gap-1.5">
            <li v-for="r in panel.fixed" :key="r.categoryId" class="flex items-center gap-2 text-sm" data-test="fixed-row">
              <VIcon :icon="r.icon" class="size-4 text-foreground-muted" />
              <span class="min-w-0 flex-1 truncate">{{ r.name }}</span>
              <span class="flex items-center gap-1 tabular-nums" :class="r.paid === 'yes' ? 'text-success' : 'text-foreground-muted'">
                <VIcon :icon="PAID_ICON[r.paid]" class="size-3.5" />
                {{ r.paidOf }}
              </span>
            </li>
          </ul>
          <p v-else class="text-sm text-foreground-muted">{{ $t('limits.budget.noFixed') }}</p>
          <p v-if="panel.fixedTakesAll" class="text-sm text-danger">{{ $t('limits.budget.takesAll') }}</p>
        </section>
        <section class="flex min-w-0 flex-col gap-2" :aria-label="panel.flexibleTitle">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-foreground-muted tabular-nums">{{ panel.flexibleTitle }}</p>
            <LimitStateChip v-if="!panel.result" :state="panel.flexible.state" :text="panel.flexible.stateText" />
            <span v-else class="text-sm font-semibold" :class="panel.result.within ? 'text-success' : 'text-danger'" data-test="budget-result">{{ panel.result.text }}</span>
          </div>
          <p class="text-2xl font-extrabold tabular-nums">{{ panel.flexible.spentOf }}</p>
          <p v-if="panel.taxesNote" class="text-xs text-foreground-muted" data-test="budget-taxes-off">{{ panel.taxesNote }}</p>
          <LimitBar :fill="panel.flexible.fill" :pace="panel.flexible.pace" :state="panel.flexible.state" thick />
          <div v-if="!panel.result" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted tabular-nums">
            <span v-if="panel.flexible.paceText" class="flex items-center gap-1">
              {{ panel.flexible.paceText }}
              <VHelpHint v-if="panel.flexible.help.forecast" :label="panel.flexible.help.forecast.title" :title="panel.flexible.help.forecast.title">
                <p v-for="(line, i) in panel.flexible.help.forecast.lines" :key="i">{{ line }}</p>
              </VHelpHint>
            </span>
            <span class="flex items-center gap-1 font-semibold text-foreground" data-test="budget-per-day">
              {{ $t('limits.perDayByBudget', { amount: panel.flexible.perDay }) }}
              <VHelpHint :label="panel.flexible.help.perDay.title" :title="panel.flexible.help.perDay.title">
                <p v-for="(line, i) in panel.flexible.help.perDay.lines" :key="i">{{ line }}</p>
              </VHelpHint>
            </span>
            <PendingNote v-if="panel.flexible.pending" :note="panel.flexible.pending" />
          </div>
        </section>
      </div>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { LimitBar, LimitStateChip, PendingNote } from '@/entities/goal';
import { VIcon } from '@/shared/ui';
import { useHomeBudget } from './composables/useHomeBudget.ts';

// Home's «Budget» row (spec desktop-home-tiles): over the whole width between the first row and «Today» / «This
// week». One line on a wide window — the total, the fixed costs paid, the flexible part with its pace, per day by the
// budget — that opens the «Budget» screen. Without a budget, in the current month, an empty row says it can be set here.
const { row, empty, budgetTo, setTo } = useHomeBudget();
</script>

<template>
  <div class="contents">
    <RouterLink
      v-if="row"
      :to="budgetTo"
      class="col-span-full grid grid-cols-1 items-center gap-x-6 gap-y-4 rounded-2xl bg-surface p-4 shadow-sm transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus @[47rem]:grid-cols-2 @[79rem]:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,4fr)_minmax(0,2fr)]"
      :aria-label="row.title"
      data-test="home-budget"
    >
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-xs text-foreground-muted">{{ row.title }}</span>
        <span class="text-2xl font-extrabold tabular-nums">{{ row.total }}</span>
        <span class="text-xs font-semibold text-primary">{{ $t('home.budget.open') }}</span>
      </div>
      <div class="flex min-w-0 flex-col gap-1.5" data-test="home-budget-fixed">
        <span class="text-xs text-foreground-muted tabular-nums">{{ row.fixedTitle }}</span>
        <div class="flex h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
          <i class="block h-full bg-success" :style="{ width: `${row.fixedPaid}%` }" />
        </div>
        <ul class="flex flex-wrap gap-1.5">
          <li
            v-for="f in row.fixed"
            :key="f.key"
            class="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
            :class="f.paid ? 'bg-success-subtle text-success' : 'bg-surface-sunken text-foreground-secondary'"
          >
            {{ f.name }} {{ f.mark }}
          </li>
        </ul>
      </div>
      <div class="flex min-w-0 flex-col gap-1.5" data-test="home-budget-flexible">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs text-foreground-muted tabular-nums">{{ row.flexibleTitle }}</span>
          <LimitStateChip v-if="!row.result" :state="row.flexible.state" :text="row.flexible.stateText" />
          <span v-else class="text-xs font-semibold" :class="row.result.within ? 'text-success' : 'text-danger'" data-test="home-budget-result">{{ row.result.text }}</span>
        </div>
        <LimitBar :fill="row.flexible.fill" :pace="row.flexible.pace" :state="row.flexible.state" />
        <span v-if="row.flexible.paceText" class="text-xs text-foreground-muted tabular-nums">{{ row.flexible.paceText }}</span>
        <PendingNote v-if="row.flexible.pending" :note="row.flexible.pending" />
      </div>
      <div class="flex min-w-0 flex-col gap-0.5" data-test="home-budget-day">
        <template v-if="row.perDay">
          <span class="text-xs text-foreground-muted">{{ $t('home.budget.perDay') }}</span>
          <span class="text-2xl font-extrabold tabular-nums">{{ row.perDay.amount }}</span>
          <span class="text-xs text-foreground-muted">{{ row.perDay.days }}</span>
        </template>
        <template v-else-if="row.result">
          <span class="text-xs text-foreground-muted">{{ $t('home.budget.left') }}</span>
          <span class="text-2xl font-extrabold tabular-nums">{{ row.result.left }}</span>
        </template>
      </div>
    </RouterLink>
    <div
      v-else-if="empty"
      class="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-gradient-to-r from-primary-subtle to-surface px-5 py-4"
      data-test="home-budget-empty"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-primary"><VIcon icon="lucide:wallet" class="size-5" /></span>
        <div class="flex min-w-0 flex-col">
          <span class="font-semibold">{{ $t('home.budget.emptyTitle') }}</span>
          <span class="text-sm text-foreground-muted">{{ $t('home.budget.emptyText') }}</span>
        </div>
      </div>
      <RouterLink :to="setTo" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-border-focus" data-test="home-budget-set">
        {{ $t('home.budget.set') }}
      </RouterLink>
    </div>
  </div>
</template>

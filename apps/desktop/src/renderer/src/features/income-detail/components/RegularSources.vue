<script setup lang="ts">
import { MoneyStack } from '@/entities/currency-display';
import type { RegularMarkTone, RegularSourceView } from '../types.ts';

const { sources } = defineProps<{ sources: ReadonlyArray<RegularSourceView> }>();

const TONE: Record<RegularMarkTone, string> = {
  ok: 'bg-success-subtle text-success',
  late: 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning',
  changed: 'bg-surface-sunken text-foreground-secondary',
};
</script>

<template>
  <section class="flex flex-col gap-2">
    <h2 class="text-base font-bold">{{ $t('income.regular.sources') }}</h2>
    <ul class="flex flex-col divide-y divide-border-subtle">
      <li v-for="s in sources" :key="s.key" class="flex min-h-14 items-center gap-3 py-2" data-test="regular-source">
        <span class="flex min-w-0 grow flex-col gap-0.5">
          <span class="truncate font-semibold" :title="s.name">{{ s.name }}</span>
          <span class="flex flex-wrap items-center gap-x-1.5 text-xs text-foreground-muted">
            <span>{{ s.often }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ $t('income.regular.last', { date: s.last }) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ $t('income.regular.next', { date: s.next }) }}</span>
            <span class="rounded-full px-1.5 font-semibold" :class="TONE[s.mark.tone]">{{ s.mark.text }}</span>
          </span>
        </span>
        <MoneyStack :amount="s.amount" :also="s.also" />
      </li>
    </ul>
  </section>
</template>

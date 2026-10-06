<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { t } from '@/shared/lib';
import { VChart, VSegmentedControl } from '@/shared/ui';
import type { CategoryRow, LinesMode } from '../types.ts';
import { linesOption } from '../utils.ts';

const { view, rows, on, fmt } = defineProps<{ view: AnalyticsOverview; rows: ReadonlyArray<CategoryRow>; on: ReadonlySet<string>; fmt: MoneyFormat }>();
const hover = defineModel<string | null>('hover', { required: true });
const mode = defineModel<LinesMode>('mode', { required: true });
const emit = defineEmits<{ toggle: [key: string]; top: []; all: [] }>();

const option = computed(() => linesOption(view, rows, on, hover.value, mode.value, fmt));
const modes = computed(() => [
  { value: 'amount' as const, label: t('analytics.views.amount') },
  { value: 'share' as const, label: t('analytics.views.share') },
]);
const BUTTON = 'h-8 rounded-lg border border-border bg-surface px-3 text-sm text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus';
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap justify-end gap-2">
      <VSegmentedControl v-model="mode" :options="modes" size="sm" />
      <button type="button" :class="BUTTON" @click="emit('top')">{{ $t('analytics.views.top') }}</button>
      <button type="button" :class="BUTTON" @click="emit('all')">{{ $t('analytics.views.allLines') }}</button>
    </div>
    <div class="h-72" aria-hidden="true"><VChart :option /></div>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="r in rows"
        :key="r.key"
        type="button"
        data-test="line-chip"
        :aria-pressed="on.has(r.key)"
        class="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-border-focus"
        :class="on.has(r.key) ? 'border-border bg-surface text-foreground' : 'border-transparent bg-surface-sunken text-foreground-muted'"
        @click="emit('toggle', r.key)"
        @mouseenter="hover = r.key"
        @mouseleave="hover = null"
        @focus="hover = r.key"
        @blur="hover = null"
      >
        <span class="size-2.5 rounded-full bg-(--dot)" :style="{ '--dot': on.has(r.key) ? r.color : 'var(--border)' }" aria-hidden="true" />
        {{ r.name }}
        <span class="text-foreground-muted tabular-nums">{{ fmt.money(r.total) }}</span>
      </button>
    </div>
  </div>
</template>

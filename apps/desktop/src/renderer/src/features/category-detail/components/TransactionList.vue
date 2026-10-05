<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/shared/lib';
import { type SegmentOption, VIcon, VInput, VSegmentedControl } from '@/shared/ui';
import { SORTS } from '../constants.ts';
import type { LineRowView, MarkView, SortKey } from '../types.ts';

const { rows, total, merchantName } = defineProps<{ rows: ReadonlyArray<LineRowView>; total: string; merchantName: string }>();
const query = defineModel<string>('query', { required: true });
const sort = defineModel<SortKey>('sort', { required: true });
const emit = defineEmits<{ clear: [] }>();

const SORT_LABEL = { date: 'category.list.byDate', amount: 'category.list.byAmount' } as const;
const sortOptions = computed<SegmentOption<SortKey>[]>(() => SORTS.map((value) => ({ value, label: t(SORT_LABEL[value]) })));
const MARK_TONE: Record<MarkView['tone'], string> = {
  warning: 'bg-warning-subtle text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))]',
  good: 'bg-success-subtle text-success',
  neutral: 'bg-surface-sunken text-foreground-secondary',
  accent: 'bg-primary-subtle text-primary',
};
const COLS = 'grid grid-cols-[7.5rem_minmax(0,1fr)_10rem_11rem_8rem] gap-3';
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="grow text-base font-bold">
        {{ $t('category.list.title') }} <span class="font-semibold text-foreground-muted">{{ rows.length }}</span>
      </h2>
      <button
        v-if="merchantName"
        type="button"
        class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-primary-subtle px-3 text-sm font-semibold ring-1 ring-primary-muted focus-visible:outline-2 focus-visible:outline-border-focus"
        :aria-label="$t('category.list.clear', { name: merchantName })"
        @click="emit('clear')"
      >
        {{ merchantName }}
        <VIcon icon="lucide:x" class="size-3.5" />
      </button>
      <VInput v-model="query" type="search" icon="lucide:search" :placeholder="$t('category.list.search')" :aria-label="$t('category.list.search')" class="w-64" />
      <VSegmentedControl v-model="sort" :options="sortOptions" :aria-label="$t('category.list.sort')" />
    </div>

    <div class="overflow-x-auto">
      <div class="flex min-w-190 flex-col" role="table" :aria-label="$t('category.list.title')">
        <div role="row" :class="COLS" class="border-b border-border-subtle px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground-muted">
          <span role="columnheader">{{ $t('category.list.col.when') }}</span>
          <span role="columnheader">{{ $t('category.list.col.where') }}</span>
          <span role="columnheader">{{ $t('category.list.col.who') }}</span>
          <span role="columnheader">{{ $t('category.list.col.marks') }}</span>
          <span role="columnheader" class="text-right">{{ $t('category.list.col.amount') }}</span>
        </div>
        <div v-for="r in rows" :key="r.key" role="row" :class="COLS" class="items-center border-b border-border-subtle px-3 py-2.5 hover:bg-surface-raised">
          <span role="cell" class="flex flex-col">
            <span class="font-semibold">{{ r.date }}</span>
            <span class="text-xs text-foreground-muted">{{ r.time }}</span>
          </span>
          <span role="cell" class="flex min-w-0 flex-col">
            <span class="truncate font-semibold" :title="r.merchant">{{ r.merchant }}</span>
            <span v-if="r.comment" class="truncate text-xs italic text-foreground-muted" :title="r.comment">{{ r.comment }}</span>
          </span>
          <span role="cell" class="flex min-w-0 items-center gap-2">
            <span v-if="r.person" class="size-2 shrink-0 rounded-full bg-(--c)" :style="{ '--c': r.personColor }" aria-hidden="true" />
            <span class="flex min-w-0 flex-col">
              <span v-if="r.person" class="truncate">{{ r.person }}</span>
              <span class="truncate text-xs text-foreground-muted" :title="r.account">{{ r.account }}</span>
            </span>
          </span>
          <span role="cell" class="flex flex-wrap gap-1">
            <span v-for="m in r.marks" :key="m.text" class="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" :class="MARK_TONE[m.tone]">{{ m.text }}</span>
          </span>
          <span role="cell" class="flex flex-col items-end">
            <span class="whitespace-nowrap font-bold tabular-nums" :class="{ 'text-success': r.refund }">{{ r.amount }}</span>
            <span v-if="r.original" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ r.original }}</span>
          </span>
        </div>
        <p v-if="rows.length === 0" class="px-3 py-5 text-foreground-muted">{{ $t('category.list.empty') }}</p>
      </div>
    </div>
    <p class="px-3 text-sm text-foreground-secondary">{{ $t('category.list.total', { amount: total }) }}</p>
  </section>
</template>

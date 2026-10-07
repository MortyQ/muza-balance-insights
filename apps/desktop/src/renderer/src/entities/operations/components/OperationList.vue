<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/shared/lib';
import { type SegmentOption, VIcon, VInput, VSegmentedControl } from '@/shared/ui';
import { OPERATION_COLS as COLS, SORTS } from '../constants.ts';
import type { LineRowView, SortKey } from '../types.ts';
import OperationRow from './OperationRow.vue';

const { rows, total, filterName, whereLabel, searchLabel } = defineProps<{
  rows: ReadonlyArray<LineRowView>;
  total: string;
  /** The name the list is filtered by; '' — none. */
  filterName: string;
  /** The text column's header («Where», «From»). */
  whereLabel: string;
  searchLabel: string;
}>();
const query = defineModel<string>('query', { required: true });
const sort = defineModel<SortKey>('sort', { required: true });
const emit = defineEmits<{ clear: [] }>();

const SORT_LABEL = { date: 'entities.operations.list.byDate', amount: 'entities.operations.list.byAmount' } as const;
const sortOptions = computed<SegmentOption<SortKey>[]>(() => SORTS.map((value) => ({ value, label: t(SORT_LABEL[value]) })));
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="grow text-base font-bold">
        {{ $t('entities.operations.list.title') }} <span class="font-semibold text-foreground-muted">{{ rows.length }}</span>
      </h2>
      <button
        v-if="filterName"
        type="button"
        class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-primary-subtle px-3 text-sm font-semibold ring-1 ring-primary-muted focus-visible:outline-2 focus-visible:outline-border-focus"
        :aria-label="$t('entities.operations.list.clear', { name: filterName })"
        @click="emit('clear')"
      >
        {{ filterName }}
        <VIcon icon="lucide:x" class="size-3.5" />
      </button>
      <VInput v-model="query" type="search" icon="lucide:search" :placeholder="searchLabel" :aria-label="searchLabel" class="w-64" />
      <VSegmentedControl v-model="sort" :options="sortOptions" :aria-label="$t('entities.operations.list.sort')" />
    </div>

    <div class="overflow-x-auto">
      <div class="flex min-w-190 flex-col" role="table" :aria-label="$t('entities.operations.list.title')">
        <div role="row" :class="COLS" class="border-b border-border-subtle px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground-muted">
          <span role="columnheader">{{ $t('entities.operations.list.col.when') }}</span>
          <span role="columnheader">{{ whereLabel }}</span>
          <span role="columnheader">{{ $t('entities.operations.list.col.who') }}</span>
          <span role="columnheader">{{ $t('entities.operations.list.col.marks') }}</span>
          <span role="columnheader" class="text-right">{{ $t('entities.operations.list.col.amount') }}</span>
        </div>
        <OperationRow v-for="r in rows" :key="r.key" :row="r" />
        <p v-if="rows.length === 0" class="px-3 py-5 text-foreground-muted">{{ $t('entities.operations.list.empty') }}</p>
      </div>
    </div>
    <p class="px-3 text-sm text-foreground-secondary">{{ $t('entities.operations.list.total', { amount: total }) }}</p>
  </section>
</template>

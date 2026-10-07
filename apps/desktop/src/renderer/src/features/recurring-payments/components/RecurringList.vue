<script setup lang="ts">
import type { RecurringMark } from '@contract/api.ts';
import type { RecurringRowView } from '../types.ts';
import RecurringRow from './RecurringRow.vue';

const { rows, title = '', hidden = false } = defineProps<{
  rows: ReadonlyArray<RecurringRowView>;
  title?: string;
  /** The hidden payments: each with «Restore». */
  hidden?: boolean;
}>();
const emit = defineEmits<{ mark: [key: string, mark: RecurringMark | null] }>();
</script>

<template>
  <section class="flex flex-col gap-1">
    <h3 v-if="title" class="text-sm font-semibold text-foreground-secondary">{{ title }}</h3>
    <ul class="flex flex-col divide-y divide-border-subtle">
      <RecurringRow v-for="row in rows" :key="row.key" :row :hidden @mark="(key, mark) => emit('mark', key, mark)" />
    </ul>
  </section>
</template>

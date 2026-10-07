<script setup lang="ts">
import type { RecurringRowView } from '../types.ts';
import RecurringRow from './RecurringRow.vue';

const { rows, title = '' } = defineProps<{ rows: ReadonlyArray<RecurringRowView>; title?: string }>();
</script>

<template>
  <section class="flex flex-col gap-1">
    <h3 v-if="title" class="text-sm font-semibold text-foreground-secondary">{{ title }}</h3>
    <ul class="flex flex-col divide-y divide-border-subtle">
      <RecurringRow v-for="row in rows" :key="row.key" :row />
    </ul>
  </section>
</template>

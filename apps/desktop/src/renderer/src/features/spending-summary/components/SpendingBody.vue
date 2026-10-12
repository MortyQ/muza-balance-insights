<script setup lang="ts">
import type { CategoriesView, PersonRowView, SummaryView } from '../types.ts';
import CategoryList from './categories/CategoryList.vue';
import SpendingSummary from './summary/SpendingSummary.vue';

// `dim` — a reload is under way: the old numbers stay, faded.
const { summary, categories, people, dim } = defineProps<{
  summary: SummaryView;
  categories: CategoriesView;
  people: ReadonlyArray<PersonRowView>;
  dim: boolean;
}>();
const emit = defineEmits<{ pick: [participantId: number | null] }>();
</script>

<template>
  <div class="flex flex-col gap-7 @3xl:flex-row" :class="{ 'opacity-60': dim }">
    <SpendingSummary :summary :people @pick="emit('pick', $event)" />
    <CategoryList :categories />
  </div>
</template>

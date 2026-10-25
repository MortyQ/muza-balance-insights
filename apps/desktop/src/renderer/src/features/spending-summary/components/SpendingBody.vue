<script setup lang="ts">
import type { CategoriesView, SummaryView } from '../types.ts';
import CategoryList from './categories/CategoryList.vue';
import SpendingSummary from './summary/SpendingSummary.vue';

// `dim` — a reload is under way: the old numbers stay, faded.
const { summary, categories, dim } = defineProps<{
  summary: SummaryView;
  categories: CategoriesView;
  dim: boolean;
}>();
</script>

<template>
  <div class="flex flex-col gap-7 @3xl:flex-row" :class="{ 'opacity-60': dim }">
    <SpendingSummary :summary />
    <CategoryList :categories />
  </div>
</template>

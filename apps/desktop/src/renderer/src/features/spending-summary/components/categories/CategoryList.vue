<script setup lang="ts">
import type { CategoriesView } from '../../types.ts';
import CategoryRow from './CategoryRow.vue';

const { categories } = defineProps<{ categories: CategoriesView }>();
</script>

<template>
  <div class="flex min-w-0 grow flex-col gap-0.5">
    <p v-if="categories.none" class="px-2.5 py-3 text-foreground-muted">{{ categories.none }}</p>
    <CategoryRow v-for="r in categories.rows" :key="r.key" :row="r" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { SHOWN_ROWS } from '../../constants.ts';
import type { CategoriesView } from '../../types.ts';
import CategoryRow from './CategoryRow.vue';

const { categories } = defineProps<{ categories: CategoriesView }>();
const all = ref(false);
const shown = computed(() => (all.value ? categories.rows : categories.rows.slice(0, SHOWN_ROWS)));
const hidden = computed(() => Math.max(0, categories.rows.length - SHOWN_ROWS));
</script>

<template>
  <div class="flex min-w-0 grow flex-col gap-0.5">
    <p v-if="categories.none" class="px-2.5 py-3 text-foreground-muted">{{ categories.none }}</p>
    <CategoryRow v-for="r in shown" :key="r.key" :row="r" />
    <button
      v-if="hidden > 0"
      type="button"
      class="self-start px-2.5 py-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
      :aria-expanded="all"
      data-test="spending-more"
      @click="all = !all"
    >
      {{ all ? $t('home.spending.showLess') : $t('home.spending.showMore', { n: hidden }, hidden) }}
    </button>
  </div>
</template>

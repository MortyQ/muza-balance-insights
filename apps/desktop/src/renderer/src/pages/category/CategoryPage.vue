<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import type { DetailPeriod } from '@contract/api.ts';
import { useMonthStore } from '@/entities/period';
import { CategoryDetailFeature } from '@/features/category-detail';
import { categoryLink, categoryRequest } from '@/shared/config';

const route = useRoute();
const router = useRouter();
const { month } = storeToRefs(useMonthStore());
// The route's guard lets only a known category in.
const request = computed(() => categoryRequest(route.params, route.query));
// A day or a week from the link, else the global filter's month.
const period = computed((): DetailPeriod => request.value.period ?? { kind: 'month', month: month.value });

// Picking a month in the global filter while a day or a week is open switches the screen to that month.
watch(month, () => {
  const { id, scope } = request.value;
  if (id && request.value.period) void router.replace(categoryLink(id, scope));
});
</script>

<template>
  <CategoryDetailFeature v-if="request.id" :category-id="request.id" :scope="request.scope" :period></CategoryDetailFeature>
</template>

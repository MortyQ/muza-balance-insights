<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { CategoryDetailFeature } from '@/features/category-detail';
import { categoryRequest } from '@/shared/config';

const route = useRoute();
// The route's guard lets only a known category in.
const request = computed(() => categoryRequest(route.params, route.query));
</script>

<template>
  <CategoryDetailFeature v-if="request.id" :category-id="request.id" :scope="request.scope"></CategoryDetailFeature>
</template>

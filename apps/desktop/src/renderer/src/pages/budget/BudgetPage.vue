<script setup lang="ts">
import { useRoute } from 'vue-router';
import { LimitsGoalsFeature } from '@/features/limits-goals';
import { budgetRequest } from '@/shared/config';

// Attached to home's «Budget» row like a category screen (no menu item); `?sheet=budget` opens the budget sheet.
const route = useRoute();
</script>

<template>
  <LimitsGoalsFeature :open-budget="budgetRequest(route.query).sheet"></LimitsGoalsFeature>
</template>

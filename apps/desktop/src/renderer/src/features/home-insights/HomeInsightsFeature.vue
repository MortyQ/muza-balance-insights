<script setup lang="ts">
import { VCard } from '@/shared/ui';
import HomeInsightsTile from './components/HomeInsightsTile.vue';
import { useHomeInsights } from './composables/useHomeInsights.ts';

// Beside «Spending by category» (spec desktop-home-insights): five of twelve columns, a row of its own below that
// width; nothing at all without a driver or a savings rate.
const { view } = useHomeInsights();
</script>

<template>
  <VCard v-if="view" as="section" padding="md" class="col-span-full @[79rem]:col-span-5" :aria-label="$t('home.insights.title')" data-test="home-insights">
    <HomeInsightsTile :view />
  </VCard>
</template>

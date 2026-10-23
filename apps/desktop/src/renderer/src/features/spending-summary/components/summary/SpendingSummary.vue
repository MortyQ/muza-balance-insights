<script setup lang="ts">
import type { SummaryView } from '../../types.ts';
import CategoryRing from './CategoryRing.vue';
import CompareNote from './CompareNote.vue';
import MemberCard from './MemberCard.vue';
import SpendingStats from './SpendingStats.vue';

const { summary } = defineProps<{ summary: SummaryView }>();
</script>

<template>
  <div class="flex w-full flex-col gap-3 @3xl:w-59 @3xl:shrink-0">
    <CategoryRing v-bind="summary.ring" />
    <CompareNote :compare="summary.compare" />
    <SpendingStats :stats="summary.stats" />
    <MemberCard v-if="summary.member" :card="summary.member" />
  </div>
</template>

<script setup lang="ts">
import type { PersonRowView, SummaryView } from '../../types.ts';
import CategoryRing from './CategoryRing.vue';
import CompareNote from './CompareNote.vue';
import MemberCard from './MemberCard.vue';
import PeopleList from './PeopleList.vue';
import SpendingStats from './SpendingStats.vue';

// `people` — the family view's list ([] otherwise).
const { summary, people } = defineProps<{ summary: SummaryView; people: ReadonlyArray<PersonRowView> }>();
const emit = defineEmits<{ pick: [participantId: number | null] }>();
</script>

<template>
  <div class="flex w-full flex-col gap-3 @3xl:w-59 @3xl:shrink-0">
    <CategoryRing v-bind="summary.ring" />
    <CompareNote :compare="summary.compare" />
    <SpendingStats :stats="summary.stats" />
    <PeopleList v-if="people.length > 0" :rows="people" @pick="emit('pick', $event)" />
    <MemberCard v-if="summary.member" :card="summary.member" />
  </div>
</template>

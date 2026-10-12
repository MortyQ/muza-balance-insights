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
  <!-- A column beside the categories from @3xl; above them before that — the ring on the left of the rest from @lg,
       so a middle-sized block has no empty sides. -->
  <div class="flex w-full flex-col gap-3 @lg:flex-row @lg:items-center @lg:gap-7 @3xl:w-59 @3xl:shrink-0 @3xl:flex-col @3xl:items-stretch @3xl:gap-3">
    <CategoryRing v-bind="summary.ring" class="shrink-0" />
    <div class="flex min-w-0 grow flex-col gap-3">
      <CompareNote :compare="summary.compare" />
      <SpendingStats :stats="summary.stats" />
      <PeopleList v-if="people.length > 0" :rows="people" @pick="emit('pick', $event)" />
      <MemberCard v-if="summary.member" :card="summary.member" />
    </div>
  </div>
</template>

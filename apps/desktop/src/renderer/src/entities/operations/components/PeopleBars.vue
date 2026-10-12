<script setup lang="ts">
import type { PersonView } from '../types.ts';
import PersonBar from './PersonBar.vue';

const { people, title } = defineProps<{ people: ReadonlyArray<PersonView>; title: string }>();
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-bold">{{ title }}</h2>
    <PersonBar v-for="p in people" :key="p.participantId" :person="p" />
  </section>
</template>

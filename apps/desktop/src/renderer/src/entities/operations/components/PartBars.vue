<script setup lang="ts">
import type { PartView } from '../types.ts';
import PartBar from './PartBar.vue';

const { parts, title } = defineProps<{ parts: ReadonlyArray<PartView>; title: string }>();
defineSlots<{ mark(props: { part: PartView }): unknown }>();
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-bold">{{ title }}</h2>
    <PartBar v-for="p in parts" :key="p.key" :part="p">
      <template #mark="slot"><slot name="mark" v-bind="slot" /></template>
    </PartBar>
  </section>
</template>

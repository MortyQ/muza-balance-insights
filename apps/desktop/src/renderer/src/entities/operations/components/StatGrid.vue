<script setup lang="ts">
import type { StatView } from '../types.ts';
import StatCell from './StatCell.vue';

const { stats } = defineProps<{ stats: ReadonlyArray<StatView> }>();
</script>

<template>
  <dl class="grid flex-[3_1_32rem] grid-cols-2 gap-x-6 gap-y-4 @2xl:grid-cols-3">
    <StatCell v-for="s in stats" :key="s.label" :stat="s" />
  </dl>
</template>

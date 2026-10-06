<script setup lang="ts">
import { computed } from 'vue';
import { compareText } from '../utils.ts';

const { from, to, thisMonth, dataFrom } = defineProps<{ from: string; to: string; thisMonth: string; dataFrom: string | null }>();
const note = computed(() => compareText({ from, to }, thisMonth, dataFrom));
</script>

<template>
  <div class="mt-0.5 text-foreground-muted">{{ note.compare }}</div>
  <div v-if="note.running" class="mt-0.5 text-warning">{{ note.running }}</div>
</template>

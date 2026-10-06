<script setup lang="ts">
import { VCard } from '@/shared/ui';
import type { KpiView } from '../types.ts';

const { items } = defineProps<{ items: ReadonlyArray<KpiView> }>();
const TONE: Readonly<Record<KpiView['tone'], string>> = { good: 'text-success', bad: 'text-danger', neutral: 'text-foreground-muted' };
</script>

<template>
  <div class="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
    <VCard v-for="k in items" :key="k.key" padding="md" data-test="kpi">
      <div class="text-sm text-foreground-muted">{{ k.label }}</div>
      <div class="mt-1 text-xl font-bold tabular-nums">{{ k.value }}</div>
      <div v-if="k.note" class="mt-1 text-xs" :class="TONE[k.tone]">{{ k.note }}</div>
    </VCard>
  </div>
</template>

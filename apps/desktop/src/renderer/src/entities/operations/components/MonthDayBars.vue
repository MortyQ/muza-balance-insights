<script setup lang="ts">
import { computed } from 'vue';
import { VChart } from '@/shared/ui';
import type { BarView } from '../types.ts';
import { daysChartOption } from '../utils.ts';

const { bars } = defineProps<{ bars: ReadonlyArray<BarView> }>();
const option = computed(() => daysChartOption(bars));
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('entities.operations.when.days') }}</h3>
    <div class="h-16"><VChart :option /></div>
  </div>
</template>

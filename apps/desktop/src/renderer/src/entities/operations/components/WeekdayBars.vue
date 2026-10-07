<script setup lang="ts">
import { computed } from 'vue';
import { VChart } from '@/shared/ui';
import type { BarView } from '../types.ts';
import { weekdaysChartOption } from '../utils.ts';

const { bars } = defineProps<{ bars: ReadonlyArray<BarView> }>();
const option = computed(() => weekdaysChartOption(bars));
</script>

<template>
  <div class="flex min-w-40 flex-1 flex-col gap-2">
    <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('entities.operations.when.weekdays') }}</h3>
    <div class="h-28"><VChart :option /></div>
    <ul class="sr-only">
      <li v-for="b in bars" :key="b.key">{{ b.title }}</li>
    </ul>
  </div>
</template>

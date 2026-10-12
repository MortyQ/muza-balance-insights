<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { SummaryView } from '../../types.ts';

const { compare } = defineProps<{ compare: SummaryView['compare'] }>();
</script>

<template>
  <p v-if="compare.none" class="text-center text-xs text-foreground-muted">{{ compare.none }}</p>
  <p v-else-if="compare.compared" class="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-foreground-secondary">
    <VIcon icon="lucide:calendar-range" class="size-3.5 shrink-0" />
    {{ compare.compared }}
  </p>
  <p v-for="l in compare.leftOut" :key="l" class="text-center text-xs text-foreground-muted">{{ l }}</p>
</template>

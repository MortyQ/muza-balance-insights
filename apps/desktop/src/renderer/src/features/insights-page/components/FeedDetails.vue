<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { VIcon } from '@/shared/ui';
import type { FeedRowView } from '../types.ts';
import InsightBars from './InsightBars.vue';

// What opens under a feed row: the months chart (with its caption and legend), the payee line, the link to look.
const { row } = defineProps<{ row: FeedRowView }>();
</script>

<template>
  <div class="flex flex-col items-start gap-3 px-4 pb-4 pl-[3.75rem]" data-test="feed-details">
    <InsightBars v-if="row.bars" :bars="row.bars" :tone="row.tone" />
    <p v-if="row.driver" class="flex items-start gap-1.5 text-sm" data-test="insight-driver">
      <VIcon icon="lucide:store" class="mt-0.5 size-3.5 shrink-0 text-foreground-muted" />
      <span class="min-w-0">{{ row.driver }}</span>
    </p>
    <RouterLink
      v-if="row.to"
      :to="row.to"
      class="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
      data-test="insight-open"
    >
      {{ row.linkText ?? $t('insights.card.open') }}
      <VIcon icon="lucide:chevron-right" class="size-3.5" />
    </RouterLink>
  </div>
</template>

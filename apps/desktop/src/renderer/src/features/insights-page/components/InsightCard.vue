<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { VCard, VChangeChip, VIcon } from '@/shared/ui';
import { SEVERITY_CHIP } from '../constants.ts';
import type { InsightCardView } from '../types.ts';
import InsightBars from './InsightBars.vue';

// One insight: what changed and how much it weighs, its months beside it, the payee behind it, and where to look.
const { card } = defineProps<{ card: InsightCardView }>();
</script>

<template>
  <VCard as="article" padding="md" :data-test="`insight-card-${card.severity}`">
    <div class="@container">
      <div class="flex flex-col gap-4 @lg:flex-row @lg:items-center">
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken">
              <VIcon :icon="card.icon" class="size-4 text-foreground-muted" />
            </span>
            <h3 class="min-w-0 truncate text-base font-bold">{{ card.title }}</h3>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="SEVERITY_CHIP[card.severity]" data-test="severity">{{ card.severityLabel }}</span>
            <VChangeChip :chip="card.chip" size="sm" class="ml-auto" />
          </div>
          <p class="text-sm text-foreground-secondary">{{ card.text }}</p>
          <p v-if="card.driver" class="flex items-start gap-1.5 text-sm" data-test="insight-driver">
            <VIcon icon="lucide:store" class="mt-0.5 size-3.5 shrink-0 text-foreground-muted" />
            <span class="min-w-0">{{ card.driver }}</span>
          </p>
          <RouterLink
            v-if="card.to"
            :to="card.to"
            class="mt-1 inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
            data-test="insight-open"
          >
            {{ card.linkText ?? $t('insights.card.open') }}
            <VIcon icon="lucide:chevron-right" class="size-3.5" />
          </RouterLink>
        </div>
        <div v-if="card.bars" class="w-full shrink-0 @lg:w-56">
          <InsightBars :bars="card.bars" :tone="card.tone" />
        </div>
      </div>
    </div>
  </VCard>
</template>

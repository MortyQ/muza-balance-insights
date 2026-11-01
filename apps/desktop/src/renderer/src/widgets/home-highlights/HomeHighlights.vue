<script setup lang="ts">
import { computed, ref } from 'vue';
import { RecentOperationsList, useRecentOperations } from '@/features/recent-operations';
import { SpendingInsights, useSpendingInsights } from '@/features/spending-summary';
import { t } from '@/shared/lib';
import { VCard, VCarousel, type CarouselSlide } from '@/shared/ui';

// The third place of the «Today» / «This week» row (spec desktop-home-highlights): «What's unusual» first when it has
// lines, «Recent operations» when the month has any; one alone without dots; neither — a line, so the place is never empty.
const { insights, loaded: insightsLoaded } = useSpendingInsights();
const { rows, loaded: recentLoaded } = useRecentOperations();

const slides = computed<CarouselSlide[]>(() => [
  ...(insights.value ? [{ id: 'unusual', label: t('home.spending.insights.title') }] : []),
  ...(rows.value.length > 0 ? [{ id: 'recent', label: t('home.recent.title') }] : []),
]);
const empty = computed(() => slides.value.length === 0 && insightsLoaded.value && recentLoaded.value);
const current = ref('');
const dotLabel = (n: number, total: number, label: string) => t('home.highlights.toSlide', { n, total, label });
</script>

<template>
  <VCard as="section" padding="md" class="col-span-full @[79rem]:col-span-4" :aria-label="slides[0]?.label ?? t('home.recent.title')" data-test="home-highlights">
    <VCarousel v-if="slides.length > 0" v-model="current" :slides :dot-label>
      <template #unusual>
        <SpendingInsights v-if="insights" :insights />
      </template>
      <template #recent>
        <RecentOperationsList :rows />
      </template>
    </VCarousel>
    <div v-else class="flex h-full flex-col gap-2">
      <h3 class="text-sm font-bold">{{ $t('home.recent.title') }}</h3>
      <p v-if="empty" class="text-sm text-foreground-muted" data-test="highlights-empty">{{ $t('home.recent.none') }}</p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useMonthStore } from '@/entities/period';
import { LimitsSlide, useHomeBudget } from '@/features/home-budget';
import { RecentOperationsList, useRecentOperations } from '@/features/recent-operations';
import { SpendingInsights, useSpendingInsights } from '@/features/spending-summary';
import { t } from '@/shared/lib';
import { VCard, VCarousel, type CarouselSlide } from '@/shared/ui';

// The third place of the «Today» / «This week» row (spec desktop-home-highlights): «What's unusual» when it has lines,
// «Limits» when a limit needs attention, «Recent operations» when the month has any — always in this order;
// one alone without dots; none — a line, so the place is never empty.
// A past month has no «Today» / «This week» and no «Recent operations»: «What's unusual» over the whole row, or no tile.
const { month, thisMonth } = storeToRefs(useMonthStore());
const past = computed(() => month.value !== thisMonth.value);
const { insights, loaded: insightsLoaded } = useSpendingInsights();
const { rows, loaded: recentLoaded } = useRecentOperations();
const { attention, budgetTo } = useHomeBudget();

// «Limits» — the current month, limits in attention or exceeded only.
const slides = computed<CarouselSlide[]>(() => [
  ...(insights.value ? [{ id: 'unusual', label: t('home.spending.insights.title') }] : []),
  ...(!past.value && attention.value.length > 0 ? [{ id: 'limits', label: t('home.budget.limitsTitle') }] : []),
  ...(rows.value.length > 0 ? [{ id: 'recent', label: t('home.recent.title') }] : []),
]);
const empty = computed(() => slides.value.length === 0 && insightsLoaded.value && recentLoaded.value);
const current = ref('');
const dotLabel = (n: number, total: number, label: string) => t('home.highlights.toSlide', { n, total, label });
</script>

<template>
  <VCard
    v-if="!past || insights"
    as="section"
    padding="md"
    class="col-span-full"
    :class="{ '@[79rem]:col-span-4': !past }"
    :aria-label="slides[0]?.label ?? t('home.recent.title')"
    data-test="home-highlights"
  >
    <VCarousel v-if="slides.length > 0" v-model="current" :slides :dot-label>
      <template #unusual>
        <SpendingInsights v-if="insights" :insights :wide="past" />
      </template>
      <template #recent>
        <RecentOperationsList :rows />
      </template>
      <template #limits>
        <LimitsSlide :limits="attention" :to="budgetTo" />
      </template>
    </VCarousel>
    <div v-else class="flex h-full flex-col gap-2">
      <h3 class="text-sm font-bold">{{ $t('home.recent.title') }}</h3>
      <p v-if="empty" class="text-sm text-foreground-muted" data-test="highlights-empty">{{ $t('home.recent.none') }}</p>
    </div>
  </VCard>
</template>

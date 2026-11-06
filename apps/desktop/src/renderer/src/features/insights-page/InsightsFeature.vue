<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { DetailSkeleton } from '@/entities/operations';
import { importLink } from '@/shared/config';
import { VButton, VCard, VIcon, VInfoNotice } from '@/shared/ui';
import FeedFilters from './components/FeedFilters.vue';
import HealthBlock from './components/HealthBlock.vue';
import InsightCard from './components/InsightCard.vue';
import InsightsGlance from './components/InsightsGlance.vue';
import SignalCard from './components/SignalCard.vue';
import { useFeedFilter } from './composables/useFeedFilter.ts';
import { useInsightsPage } from './composables/useInsightsPage.ts';
import { filterFeed } from './utils/feed.ts';

// The Insights screen (specs desktop-insights-page, desktop-insights-health): the month at a glance, financial health,
// then one feed of every signal ranked by money with its filters, and how it was counted.
const { state, view } = useInsightsPage();
const { filter, set, reset } = useFeedFilter();
const shown = computed(() => (view.value ? filterFeed(view.value.feed, filter.value) : []));
</script>

<template>
  <div class="@container flex flex-col gap-4" data-test="insights-page">
    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('insights.failed')" />

    <DetailSkeleton v-if="!view && state.status === 'loading'" />
    <template v-else-if="view">
      <div class="flex flex-col gap-4" :class="{ 'opacity-60': state.status === 'loading' }">
        <InsightsGlance :items="view.glance" />
        <HealthBlock :health="view.health" />

        <VCard v-if="view.early" padding="md" data-test="insights-early">
          <div class="flex flex-col items-start gap-2">
            <h2 class="text-base font-bold">{{ $t('insights.early.title') }}</h2>
            <p class="text-sm text-foreground-secondary">{{ view.early }}</p>
            <RouterLink :to="importLink()" class="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus">
              {{ $t('insights.early.download') }}
            </RouterLink>
          </div>
        </VCard>

        <template v-else>
          <section class="flex min-w-0 flex-col gap-3" :aria-label="$t('insights.feed.title')">
            <div class="flex items-baseline justify-between gap-2">
              <h2 class="text-base font-bold">{{ $t('insights.feed.title') }}</h2>
              <span class="text-xs text-foreground-muted">{{ $t('insights.feed.ranked') }}</span>
            </div>
            <VCard v-if="view.calm" padding="md" data-test="insights-calm">
              <div class="flex items-center gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--success)_16%,transparent)]">
                  <VIcon icon="lucide:check" class="size-4 text-success" />
                </span>
                <div>
                  <p class="text-sm font-semibold">{{ $t('insights.feed.calm') }}</p>
                  <p class="text-xs text-foreground-muted">{{ $t('insights.feed.calmHint') }}</p>
                </div>
              </div>
            </VCard>
            <template v-else>
              <FeedFilters :items="view.feed" :filter @change="set" />
              <VCard v-if="shown.length === 0" padding="md" data-test="feed-empty">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-sm text-foreground-secondary">{{ $t('insights.filter.empty') }}</p>
                  <VButton variant="link" size="sm" :text="$t('insights.filter.reset')" data-test="feed-reset" @click="reset" />
                </div>
              </VCard>
              <template v-for="item in shown" :key="item.key">
                <InsightCard v-if="item.card" :card="item.card" />
                <SignalCard v-else-if="item.signal" :signal="item.signal" />
              </template>
            </template>
          </section>

          <VCard padding="md" data-test="insights-basis">
            <h2 class="text-sm font-bold">{{ $t('insights.basis.title') }}</h2>
            <ul class="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-foreground-muted">
              <li v-for="(line, i) in view.basis" :key="i">{{ line }}</li>
            </ul>
          </VCard>
        </template>
      </div>
    </template>
  </div>
</template>

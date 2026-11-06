<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { DetailSkeleton } from '@/entities/operations';
import { importLink } from '@/shared/config';
import { VCard, VIcon, VInfoNotice } from '@/shared/ui';
import HealthBlock from './components/HealthBlock.vue';
import InsightCard from './components/InsightCard.vue';
import InsightsGlance from './components/InsightsGlance.vue';
import SignalList from './components/SignalList.vue';
import { useInsightsPage } from './composables/useInsightsPage.ts';

// The Insights screen (spec desktop-insights-page): the month at a glance, then the feed ranked by money (eight of
// twelve columns from 64rem of its own width) beside «Budget structure», the payee signals and how it was counted.
const { state, view } = useInsightsPage();
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
        <div v-else class="grid grid-cols-1 gap-4 @5xl:grid-cols-12">
          <section class="flex min-w-0 flex-col gap-3 @5xl:col-span-8" :aria-label="$t('insights.feed.title')">
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
            <InsightCard v-for="c in view.cards" :key="c.key" :card="c" />
          </section>

          <aside class="flex min-w-0 flex-col gap-4 @5xl:col-span-4">
            <VCard padding="md" data-test="new-payees">
              <SignalList :title="$t('insights.newPayees.title')" :hint="$t('insights.newPayees.hint')" :rows="view.newPayees" :empty="$t('insights.newPayees.none')" />
            </VCard>
            <VCard padding="md" data-test="one-offs">
              <SignalList :title="$t('insights.oneOffs.title')" :hint="$t('insights.oneOffs.hint')" :rows="view.oneOffs" :empty="$t('insights.oneOffs.none')" />
            </VCard>
            <VCard padding="md" data-test="insights-basis">
              <h2 class="text-sm font-bold">{{ $t('insights.basis.title') }}</h2>
              <ul class="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-foreground-muted">
                <li v-for="(line, i) in view.basis" :key="i">{{ line }}</li>
              </ul>
            </VCard>
          </aside>
        </div>
      </div>
    </template>
  </div>
</template>

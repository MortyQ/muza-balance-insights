<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { VCard } from '@/shared/ui';
import SpendingBody from './components/SpendingBody.vue';
import SpendingHeader from './components/SpendingHeader.vue';
import SpendingInsights from './components/SpendingInsights.vue';
import SpendingNotices from './components/SpendingNotices.vue';
import PeopleList from './components/summary/PeopleList.vue';
import { useSpending } from './composables/useSpending.ts';
import { useSpendingView } from './composables/useSpendingView.ts';
import { useSpendingPrefsStore } from './store/useSpendingPrefsStore.ts';

/** The page hides «What's unusual» while the «Now» details tile takes its place. */
const { insightsHidden = false } = defineProps<{ insightsHidden?: boolean }>();

const base = useSpending();
const { scope, state, view, periodNote, importing, family } = base;
const prefsStore = useSpendingPrefsStore();
const { prefs } = storeToRefs(prefsStore);
const { subtitle, hasData, empty, leftOut, summary, categories, people, insights, onPick } = useSpendingView(base, prefs);
</script>

<template>
  <div class="contents">
    <!-- Tiles of the home grid (spec desktop-home-tiles): «What's unusual» (in the «Now» row; the page hides it while
         the «Now» details take its place), «Spending by category» (two columns, two rows), «Who spent what» (the family
         view's people, picking the person for this block). -->
    <VCard v-if="insights && !insightsHidden" as="section" padding="md" class="col-span-full @[79rem]:col-span-4" :aria-label="$t('home.spending.insights.title')" data-test="spending-unusual">
      <SpendingInsights :insights />
    </VCard>
    <VCard padding="md" class="col-span-full @[79rem]:col-span-9 @[79rem]:row-span-2" data-test="spending-tile">
      <div class="@container flex flex-col gap-4">
        <SpendingHeader v-model:scope="scope" :subtitle :prefs :family @set="prefsStore.set" />
        <SpendingNotices
          :failed="state.status === 'error'"
          :note="periodNote"
          :importing
          :pending-holds="view?.period.pendingHolds ?? 0"
          :empty
          :left-out
        />
        <SpendingBody v-if="summary && hasData" :summary :categories :dim="state.status === 'loading'" />
        <p v-if="hasData" class="text-sm text-foreground-muted">{{ $t('home.spending.footnote') }}</p>
      </div>
    </VCard>
    <VCard v-if="summary && hasData && people.length > 0" as="section" padding="md" class="@[79rem]:col-span-3" :aria-label="$t('home.spending.whoSpent')" data-test="spending-people">
      <div class="flex flex-col gap-2" :class="{ 'opacity-60': state.status === 'loading' }">
        <h3 class="text-sm font-bold">{{ $t('home.spending.whoSpent') }}</h3>
        <PeopleList :rows="people" @pick="onPick" />
      </div>
    </VCard>
  </div>
</template>

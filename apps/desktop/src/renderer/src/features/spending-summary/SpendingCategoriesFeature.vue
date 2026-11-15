<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { BackLink } from '@/entities/operations';
import { t } from '@/shared/lib';
import { VCard, VSegmentedControl } from '@/shared/ui';
import SpendingNotices from './components/SpendingNotices.vue';
import CategoryRow from './components/categories/CategoryRow.vue';
import { SCOPES } from './constants.ts';
import { useSpending } from './composables/useSpending.ts';
import { useSpendingView } from './composables/useSpendingView.ts';
import { useSpendingPrefsStore } from './store/useSpendingPrefsStore.ts';
import { totalFor } from './utils/index.ts';

// «All categories»: every category of the month as its own row, built by the same code as home's block; the view
// settings are home's own (changed there).
const base = useSpending();
const { scope, state, view, periodNote, importing, fmt } = base;
const { prefs } = storeToRefs(useSpendingPrefsStore());
const { subtitle, hasData, empty, leftOut, categories } = useSpendingView(base, prefs, true);
const scopes = computed(() => SCOPES.map((s) => ({ ...s, label: t(s.label) })));
const heading = computed(() => [subtitle.value, view.value && hasData.value ? fmt.value.money(totalFor(view.value, null).net) : ''].filter(Boolean).join(' · '));
</script>

<template>
  <div class="@container flex flex-col gap-4">
    <BackLink :label="$t('home.spending.all.back')" />
    <VCard padding="md">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 items-baseline gap-2.5">
            <h2 class="text-base font-bold">{{ $t('home.spending.all.title') }}</h2>
            <span class="truncate text-sm text-foreground-muted">{{ heading }}</span>
          </div>
          <VSegmentedControl v-model="scope" :options="scopes" />
        </div>
        <SpendingNotices
          :failed="state.status === 'error'"
          :note="periodNote"
          :importing
          :pending-holds="view?.period.pendingHolds ?? 0"
          :empty
          :left-out
        />
        <div v-if="hasData" class="flex min-w-0 flex-col gap-0.5" :class="{ 'opacity-60': state.status === 'loading' }" data-test="all-categories">
          <CategoryRow v-for="r in categories.rows" :key="r.key" :row="r" />
        </div>
        <p v-if="hasData" class="text-sm text-foreground-muted">{{ $t('home.spending.footnote') }}</p>
      </div>
    </VCard>
  </div>
</template>

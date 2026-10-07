<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { VCard } from '@/shared/ui';
import SpendingBody from './components/SpendingBody.vue';
import SpendingHeader from './components/SpendingHeader.vue';
import SpendingNotices from './components/SpendingNotices.vue';
import { useSpending } from './composables/useSpending.ts';
import { useSpendingView } from './composables/useSpendingView.ts';
import { useSpendingPrefsStore } from './store/useSpendingPrefsStore.ts';

const base = useSpending();
const { scope, state, view, periodNote, importing, family } = base;
const prefsStore = useSpendingPrefsStore();
const { prefs } = storeToRefs(prefsStore);
const { subtitle, hasData, empty, leftOut, summary, categories, people, onPick } = useSpendingView(base, prefs);
</script>

<template>
  <VCard padding="md">
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
      <SpendingBody v-if="summary && hasData" :summary :categories :people :dim="state.status === 'loading'" @pick="onPick" />
      <p v-if="hasData" class="text-sm text-foreground-muted">{{ $t('home.spending.footnote') }}</p>
    </div>
  </VCard>
</template>

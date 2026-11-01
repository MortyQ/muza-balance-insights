<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useParticipantStore } from '@/entities/participant';
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
const participant = useParticipantStore();
const banks = computed(() => participant.shown.length > 1);
const { subtitle, hasData, empty, leftOut, summary, categories } = useSpendingView(base, prefs);
</script>

<template>
  <div class="contents">
    <!-- «Spending by category», a home tile over the whole width (spec desktop-home-tiles). «What's unusual» is a slide of
         widgets/home-highlights; «Who spent what» is off home for now, its PeopleList kept for a later place. -->
    <VCard padding="md" class="col-span-full" data-test="spending-tile">
      <div class="@container flex flex-col gap-4">
        <SpendingHeader v-model:scope="scope" :subtitle :prefs :family :banks @set="prefsStore.set" />
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
  </div>
</template>

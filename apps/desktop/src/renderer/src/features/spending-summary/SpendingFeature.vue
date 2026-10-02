<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { monthName, t } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import CategoryRing from './components/CategoryRing.vue';
import CategoryRow from './components/CategoryRow.vue';
import PeopleList from './components/PeopleList.vue';
import SpendingHeader from './components/SpendingHeader.vue';
import { useSpending } from './composables/useSpending.ts';
import { useSpendingPrefsStore } from './store/useSpendingPrefsStore.ts';
import {
  centerChip, centerConv, familyShareText, initial, leftOutLines, money, noCompareText, opsVs, peopleRows, prevInText, ringOf, rowsFor, totalFor,
} from './utils.ts';

const { month, scope, state, view, periodNote, importing, family, member, people, selected, pick, open } = useSpending();
const prefsStore = useSpendingPrefsStore();
const { prefs } = storeToRefs(prefsStore);

/** Family: «Вся семья» or the picked person; a family member in the global filter: their name; the only person: none. */
const who = computed(() => {
  if (family.value) return pick.value === null ? t('home.spending.whole') : (people.value.find((p) => p.id === pick.value)?.name ?? '');
  return member.value ? (selected.value?.name ?? '') : '';
});
const subtitle = computed(() => [monthName(Number(month.value.slice(5, 7))), who.value].filter(Boolean).join(' · '));
/** The in-block pick counts in the family view only. */
const blockPick = computed(() => (family.value ? pick.value : null));
const rows = computed(() => (view.value ? rowsFor(view.value, blockPick.value, people.value, prefs.value) : []));
const total = computed(() => (view.value ? totalFor(view.value, blockPick.value) : null));
const ring = computed(() => (view.value ? ringOf(rows.value, view.value, blockPick.value) : ''));
const chip = computed(() => (view.value && total.value ? centerChip(total.value.net, total.value.prev?.net ?? null, view.value.month, view.value.compare?.partial ?? false) : null));
const conv = computed(() => (view.value && total.value ? centerConv(total.value.net, total.value.prev?.net ?? null, view.value, prefs.value) : []));
const perDay = computed(() => {
  const v = view.value;
  if (!v || !total.value || v.period.coveredDays === 0) return null;
  return t('home.spending.perDayShort', { amount: money(Math.round(total.value.net / v.period.coveredDays)) });
});
const whoRows = computed(() => (view.value && family.value ? peopleRows(view.value, pick.value, people.value) : []));
const leftOut = computed(() => (view.value ? leftOutLines(view.value) : []));
const memberShare = computed(() => (view.value && total.value && view.value.familyTotal !== null ? familyShareText(total.value.net, view.value.familyTotal) : ''));

function onPick(id: number | null): void {
  pick.value = id;
}
function onToggle(key: string): void {
  open.value = open.value === key ? null : key;
}
</script>

<template>
  <VCard padding="md">
    <div class="flex flex-col gap-4">
      <SpendingHeader v-model:scope="scope" :subtitle :prefs :family :fx="view?.fx ?? []" @set="prefsStore.set" />

      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.spending.failed')" />
      <VInfoNotice v-else-if="periodNote" :card="false" icon="lucide:info" tone="info" :subtitle="periodNote" />
      <p v-if="importing" class="text-sm text-foreground-muted">{{ $t('home.spending.importing') }}</p>
      <p v-if="view && view.period.pendingHolds > 0" class="text-sm text-foreground-muted">
        {{ $t('home.spending.pending', { count: view.period.pendingHolds }) }}
      </p>
      <p v-if="view && state.status !== 'error' && rows.length === 0 && view.period.dataUntil !== null" class="text-foreground-muted">
        {{ $t('home.spending.empty') }}
      </p>

      <div v-if="view && total && rows.length > 0" class="flex gap-7" :class="{ 'opacity-60': state.status === 'loading' }">
        <div class="flex w-59 shrink-0 flex-col gap-3">
          <p class="sr-only"><span>{{ who || $t('home.spending.title') }}</span> <span>{{ money(total.net) }}</span></p>
          <CategoryRing :stops="ring" :label="who || $t('home.spending.title')" :amount="money(total.net)" :per-day :chip :conv />
          <p v-if="!view.compare" class="text-center text-xs text-foreground-muted">{{ noCompareText(view.month) }}</p>
          <p v-for="l in leftOut" :key="l" class="text-center text-xs text-foreground-muted">{{ l }}</p>
          <div class="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3.5">
            <div class="flex flex-col gap-0.5">
              <span class="text-xs text-foreground-muted">{{ $t('home.spending.operations') }}</span>
              <span class="flex items-baseline gap-1.5 whitespace-nowrap">
                <span class="text-[15px] font-bold tabular-nums">{{ total.purchases }}</span>
                <span class="text-xs font-bold tabular-nums">{{ opsVs(total.purchases, total.prev?.purchases ?? null, view.month) }}</span>
              </span>
            </div>
            <div v-if="total.prev" class="flex flex-col gap-0.5">
              <span class="text-xs text-foreground-muted">{{ prevInText(view.month) }}</span>
              <span class="whitespace-nowrap text-[15px] font-bold tabular-nums">{{ money(total.prev.net) }}</span>
            </div>
          </div>
          <PeopleList v-if="family" :rows="whoRows" @pick="onPick" />
          <div v-if="member && selected && view.familyTotal !== null" class="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-raised p-2.5">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-(--c) text-[13px] font-extrabold text-white" :style="{ '--c': selected.color }" aria-hidden="true">
              {{ initial(selected.name) }}
            </span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="font-semibold">{{ memberShare }}</span>
              <span class="whitespace-nowrap text-xs text-foreground-muted">{{ $t('home.spending.familyTotal', { amount: money(view.familyTotal) }) }}</span>
            </span>
          </div>
        </div>
        <div class="flex min-w-0 grow flex-col gap-0.5">
          <CategoryRow v-for="r in rows" :key="r.key" :row="r" :expandable="family" :open="open === r.key" @toggle="onToggle(r.key)" />
        </div>
      </div>

      <p v-if="view && rows.length > 0" class="text-sm text-foreground-muted">{{ $t('home.spending.footnote') }}</p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import { t } from '@/shared/lib';
import { VCard, VChangeChip, VIcon, VSegmentedControl, type SegmentOption } from '@/shared/ui';
import CategoryList from './components/CategoryList.vue';
import TileCategories from './components/TileCategories.vue';
import WeekBars from './components/WeekBars.vue';
import { useNowStrip } from './composables/useNowStrip.ts';
import { SHOWN_CATEGORIES } from './constants.ts';
import { useNowPrefsStore } from './store/useNowPrefsStore.ts';
import type { NowPeriod } from './types.ts';

const { visible, view } = useNowStrip();
const prefs = useNowPrefsStore();
const details = useTemplateRef<HTMLElement>('details');

/** The details tile is open: the page hides «What's unusual» meanwhile. Closed whenever the strip itself is hidden. */
const open = defineModel<boolean>('details', { default: false });
watch(visible, (v) => {
  if (!v) open.value = false;
});
const period = computed({ get: () => prefs.prefs.period, set: (v: NowPeriod) => prefs.set('period', v) });
const periods = computed((): SegmentOption<NowPeriod>[] => [
  { label: t('home.now.cats.today'), value: 'today' },
  { label: t('home.now.cats.week'), value: 'week' },
]);
function openDetails(p: NowPeriod): void {
  period.value = p;
  open.value = true;
  void nextTick(() => details.value?.focus());
}
const list = computed(() => view.value?.categories[period.value] ?? null);
</script>

<template>
  <div class="contents">
    <!-- «Today» and «This week» as tiles of the home grid (spec desktop-home-tiles), each with its 3 biggest categories;
         their button opens the details tile in their place (with «What's unusual», which the page hides meanwhile). -->
    <template v-if="visible && view">
      <template v-if="!open">
        <VCard as="section" padding="md" :aria-label="view.today.title" data-test="now-today">
          <div class="flex h-full flex-col gap-3">
            <div>
              <h3 class="text-sm font-bold">{{ view.today.title }}</h3>
              <p class="mt-1 flex flex-wrap items-center gap-2">
                <span class="text-2xl font-bold whitespace-nowrap tabular-nums">{{ view.today.amount }}</span>
                <VChangeChip v-if="view.today.chip" :chip="view.today.chip" size="sm" />
              </p>
              <p v-if="view.today.conv" class="text-xs whitespace-nowrap text-foreground-muted tabular-nums">{{ view.today.conv }}</p>
              <p v-if="view.today.until" class="text-xs text-foreground-muted">{{ view.today.until }}</p>
              <p v-else class="text-xs text-foreground-muted">{{ view.today.ops }}<template v-if="view.today.context"> · {{ view.today.context }}</template></p>
            </div>
            <TileCategories v-if="view.categories.today.rows.length > 0" :rows="view.categories.today.rows.slice(0, SHOWN_CATEGORIES)" />
            <p v-else class="text-sm text-foreground-muted" data-test="now-none-today">{{ $t('home.now.cats.noneToday') }}</p>
            <button
              v-if="view.categories.today.rows.length > 0"
              type="button"
              class="mt-auto self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
              data-test="now-open-today"
              @click="openDetails('today')"
            >
              {{ view.categories.today.more || $t('home.now.cats.details') }}
            </button>
          </div>
        </VCard>

        <VCard as="section" padding="md" :aria-label="view.week.title" data-test="now-week">
          <div class="flex h-full flex-col gap-3">
            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-sm font-bold">{{ view.week.title }}</h3>
                <p class="mt-1 flex flex-wrap items-center gap-2">
                  <span class="text-2xl font-bold whitespace-nowrap tabular-nums">{{ view.week.amount }}</span>
                  <VChangeChip v-if="view.week.chip" :chip="view.week.chip" size="sm" />
                </p>
                <p v-if="view.week.conv" class="text-xs whitespace-nowrap text-foreground-muted tabular-nums">{{ view.week.conv }}</p>
                <p v-if="view.week.context" class="text-xs text-foreground-muted">{{ view.week.context }}</p>
              </div>
              <WeekBars :bars="view.week.bars" />
            </div>
            <TileCategories v-if="view.categories.week.rows.length > 0" :rows="view.categories.week.rows.slice(0, SHOWN_CATEGORIES)" />
            <p v-else class="text-sm text-foreground-muted">{{ $t('home.now.noneWeek') }}</p>
            <p v-if="view.week.pending > 0" class="flex items-center gap-1.5 text-xs text-foreground-muted" :title="$t('home.now.pendingTitle')">
              <VIcon icon="lucide:clock" class="size-3 shrink-0" />
              {{ $t('home.now.pending', { count: view.week.pending }) }}
            </p>
            <button
              v-if="view.categories.week.rows.length > 0"
              type="button"
              class="mt-auto self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
              data-test="now-open-week"
              @click="openDetails('week')"
            >
              {{ view.categories.week.more || $t('home.now.cats.details') }}
            </button>
          </div>
        </VCard>
      </template>

      <VCard v-else as="section" padding="md" class="col-span-full" :aria-label="$t('home.now.cats.label')" data-test="now-details">
        <div ref="details" class="@container flex flex-col gap-3" tabindex="-1">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-sm font-bold">{{ $t('home.now.cats.label') }}</h3>
              <VSegmentedControl v-model="period" :options="periods" size="sm" role="group" :aria-label="$t('home.now.cats.period')" />
              <span v-if="list?.summary" class="text-xs text-foreground-muted tabular-nums">{{ list.summary }}</span>
            </div>
            <button
              type="button"
              class="grid size-7 place-items-center rounded-full bg-surface-sunken text-foreground-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-focus"
              :aria-label="$t('home.now.cats.close')"
              data-test="now-close"
              @click="open = false"
            >
              <VIcon icon="lucide:x" :size="14" />
            </button>
          </div>
          <CategoryList v-if="list" :list :empty="period === 'today' ? $t('home.now.cats.noneToday') : $t('home.now.noneWeek')" />
          <p v-if="period === 'week' && list?.note" class="text-xs text-foreground-muted">{{ list.note }}</p>
        </div>
      </VCard>
    </template>
  </div>
</template>

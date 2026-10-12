<script setup lang="ts">
import { computed, useId } from 'vue';
import { t } from '@/shared/lib';
import { VCard, VChangeChip, VCollapse, VIcon, VSegmentedControl, type SegmentOption } from '@/shared/ui';
import CategoryList from './components/CategoryList.vue';
import WeekBars from './components/WeekBars.vue';
import { useNowStrip } from './composables/useNowStrip.ts';
import { useNowPrefsStore } from './store/useNowPrefsStore.ts';
import type { NowPeriod } from './types.ts';

const { visible, view } = useNowStrip();
const prefs = useNowPrefsStore();
const panelId = useId();

const open = computed({ get: () => prefs.prefs.open, set: (v: boolean) => prefs.set('open', v) });
const period = computed({ get: () => prefs.prefs.period, set: (v: NowPeriod) => prefs.set('period', v) });
const periods = computed((): SegmentOption<NowPeriod>[] => [
  { label: t('home.now.cats.today'), value: 'today' },
  { label: t('home.now.cats.week'), value: 'week' },
]);
const list = computed(() => view.value?.categories[period.value] ?? null);
</script>

<template>
  <VCard v-if="visible && view" as="section" padding="none" :aria-label="$t('home.now.label')">
    <div class="@container">
      <div class="grid grid-cols-1 divide-y divide-border-subtle @2xl:grid-cols-3 @2xl:divide-x @2xl:divide-y-0">
        <div class="flex min-w-0 flex-col gap-1 px-4 py-3">
          <h3 class="text-xs font-semibold text-foreground-muted">{{ view.today.title }}</h3>
          <p class="flex items-baseline gap-2 whitespace-nowrap">
            <span class="text-2xl font-bold tabular-nums">{{ view.today.amount }}</span>
            <span class="text-xs text-foreground-muted">{{ view.today.ops }}</span>
          </p>
          <p v-if="view.today.conv" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ view.today.conv }}</p>
          <p v-if="view.today.until" class="text-xs text-foreground-muted">{{ view.today.until }}</p>
          <p v-else-if="view.today.chip || view.today.context" class="flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
            <VChangeChip v-if="view.today.chip" :chip="view.today.chip" size="sm" />
            <span>{{ view.today.context }}</span>
          </p>
        </div>

        <div class="flex min-w-0 flex-col gap-1 px-4 py-3">
          <h3 class="text-xs font-semibold text-foreground-muted">{{ view.week.title }}</h3>
          <div class="flex items-end justify-between gap-3">
            <span class="whitespace-nowrap text-2xl font-bold tabular-nums">{{ view.week.amount }}</span>
            <WeekBars :bars="view.week.bars" />
          </div>
          <p v-if="view.week.conv" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ view.week.conv }}</p>
          <p v-if="view.week.chip || view.week.context" class="flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
            <VChangeChip v-if="view.week.chip" :chip="view.week.chip" size="sm" />
            <span>{{ view.week.context }}</span>
          </p>
          <p v-if="view.week.pending > 0" class="flex items-center gap-1.5 text-xs text-foreground-muted" :title="$t('home.now.pendingTitle')">
            <VIcon icon="lucide:clock" class="size-3 shrink-0" />
            {{ $t('home.now.pending', { count: view.week.pending }) }}
          </p>
        </div>

        <div class="flex min-w-0 flex-col gap-1 px-4 py-3">
          <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('home.now.top') }}</h3>
          <template v-if="view.top">
            <p class="flex min-w-0 items-center gap-2">
              <span class="size-2.5 shrink-0 rounded-full bg-(--c)" :style="{ '--c': view.top.color }" aria-hidden="true" />
              <span class="truncate font-semibold" :title="view.top.name">{{ view.top.name }}</span>
            </p>
            <p class="whitespace-nowrap text-lg font-bold tabular-nums">{{ view.top.amount }}</p>
            <p class="whitespace-nowrap text-xs text-foreground-muted">{{ view.top.caption }}</p>
          </template>
          <p v-else class="text-sm text-foreground-muted">{{ $t('home.now.noneWeek') }}</p>
        </div>
      </div>

      <button
        type="button"
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-border-subtle px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
        :aria-expanded="open"
        :aria-controls="panelId"
        data-test="now-categories-toggle"
        @click="open = !open"
      >
        {{ $t('home.now.cats.toggle') }}
        <VIcon icon="lucide:chevron-down" class="size-3.5 transition-transform motion-reduce:transition-none" :class="{ 'rotate-180': open }" />
      </button>

      <VCollapse :id="panelId" v-model="open" unmount>
        <div class="flex flex-col gap-3 border-t border-border-subtle px-4 pt-3 pb-4" role="region" :aria-label="$t('home.now.cats.label')">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <VSegmentedControl v-model="period" :options="periods" size="sm" role="group" :aria-label="$t('home.now.cats.period')" />
            <span v-if="list?.summary" class="text-xs text-foreground-muted tabular-nums">{{ list.summary }}</span>
          </div>
          <CategoryList
            v-if="list"
            :list
            :empty="period === 'today' ? $t('home.now.cats.noneToday') : $t('home.now.noneWeek')"
          />
          <p v-if="period === 'week' && list?.note" class="text-xs text-foreground-muted">{{ list.note }}</p>
        </div>
      </VCollapse>
    </div>
  </VCard>
</template>

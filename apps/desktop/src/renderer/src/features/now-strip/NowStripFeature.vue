<script setup lang="ts">
import { VCard, VChangeChip, VIcon } from '@/shared/ui';
import WeekBars from './components/WeekBars.vue';
import { useNowStrip } from './composables/useNowStrip.ts';

const { visible, view } = useNowStrip();
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
    </div>
  </VCard>
</template>

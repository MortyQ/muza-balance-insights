<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ROUTE } from '@/shared/config';
import { VChangeChip, VHelpHint, VIcon, VShareBar } from '@/shared/ui';
import type { InsightsView } from '../types.ts';

// A category line opens its screen (`l.to`); income lines are plain. `wide` — the block has the whole row (a past
// month): the lines stand in two columns instead of stretching.
const { insights, wide = false } = defineProps<{ insights: InsightsView; wide?: boolean }>();
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <div class="flex items-baseline justify-between gap-2">
      <div class="flex items-center gap-1">
        <h3 class="text-sm font-bold">{{ $t('home.spending.insights.title') }}</h3>
        <VHelpHint :label="$t('common.helpLabel', { name: $t('home.spending.insights.title') })">{{ $t('home.spending.insights.help') }}</VHelpHint>
      </div>
      <RouterLink
        :to="{ name: ROUTE.insights }"
        class="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
        data-test="all-insights"
      >
        {{ $t('home.insights.all') }}
      </RouterLink>
    </div>
    <!-- «Spending»'s row look (spec desktop-home-tiles): the icon in a soft circle of the category's colour, the name with
         now and the usual under it, the change, the bar of this month with the usual's mark. -->
    <ul class="grid gap-x-4 gap-y-0.5" :class="{ '@[60rem]:grid-cols-2': wide }">
      <li v-for="(l, i) in insights.lines" :key="i">
        <component
          :is="l.to ? RouterLink : 'div'"
          :to="l.to ?? undefined"
          :aria-label="l.text"
          class="grid grid-cols-[1.75rem_minmax(0,1fr)_auto_0.875rem] items-center gap-x-3 gap-y-1.5 rounded-xl px-2.5 py-2"
          :class="{ 'cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': l.to }"
          :style="{ '--c': l.color }"
          data-test="insight-line"
        >
          <span class="grid size-7 place-items-center rounded-full bg-[color-mix(in_oklch,var(--c)_16%,transparent)]" aria-hidden="true">
            <VIcon :icon="l.icon" :color="l.color" class="size-3.5" />
          </span>
          <span class="flex min-w-0 flex-col" aria-hidden="true">
            <span class="truncate text-sm font-semibold" :title="l.name">{{ l.name }}</span>
            <span class="truncate text-xs text-foreground-muted tabular-nums">{{ l.caption }}</span>
          </span>
          <VChangeChip :chip="l.chip" size="sm" aria-hidden="true" />
          <VIcon v-if="l.to" icon="lucide:chevron-right" class="size-3.5 text-foreground-muted" />
          <span v-else aria-hidden="true" />
          <VShareBar :value="l.bar.value" :mark="l.bar.mark" :color="l.color" size="xs" class="col-start-2 col-end-4" />
        </component>
      </li>
    </ul>
    <p class="mt-auto text-xs text-foreground-muted">{{ insights.note }}</p>
  </div>
</template>

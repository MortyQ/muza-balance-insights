<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ROUTE } from '@/shared/config';
import { VIcon } from '@/shared/ui';
import { DRIVER_TONE } from '../constants.ts';
import type { HomeInsightsView } from '../types.ts';

// A driver row opens its category (`d.to`); the savings rate and the note are plain.
const { view } = defineProps<{ view: HomeInsightsView }>();
</script>

<template>
  <div class="flex h-full flex-col gap-3">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-bold">{{ $t('home.insights.title') }}</h3>
      <RouterLink
        :to="{ name: ROUTE.insights }"
        class="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
        data-test="all-insights"
      >
        {{ $t('home.insights.all') }}
      </RouterLink>
    </div>
    <ul v-if="view.drivers.length > 0" class="flex flex-col gap-0.5">
      <li v-for="d in view.drivers" :key="d.key">
        <component
          :is="d.to ? RouterLink : 'div'"
          :to="d.to ?? undefined"
          class="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm"
          :class="{ 'hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': d.to }"
          data-test="driver-row"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken">
            <VIcon :icon="d.icon" class="size-3.5 text-foreground-muted" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{{ d.name }}</span>
            <span class="truncate text-xs text-foreground-muted">{{ d.caption }}</span>
          </span>
          <span class="shrink-0 tabular-nums" :class="DRIVER_TONE[d.tone]">{{ d.amount }}</span>
        </component>
      </li>
    </ul>
    <div v-if="view.savings" class="flex items-baseline justify-between gap-3 rounded-lg bg-surface-sunken px-2.5 py-2 text-sm" data-test="savings-line">
      <span>{{ view.savings.title }}</span>
      <span class="shrink-0 text-right">
        <span class="font-semibold tabular-nums" :class="{ 'text-danger': view.savings.over }">{{ view.savings.value }}</span>
        <span class="ml-1.5 text-xs text-foreground-muted">{{ view.savings.usual }}</span>
      </span>
    </div>
    <div class="mt-auto flex flex-col gap-1 text-xs text-foreground-muted" data-test="insights-note">
      <p>{{ view.note }}</p>
      <p v-if="view.pending">{{ view.pending }}</p>
    </div>
  </div>
</template>

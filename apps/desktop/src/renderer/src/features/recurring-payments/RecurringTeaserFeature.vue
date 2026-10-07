<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ROUTE } from '@/shared/config';
import { VCard, VIcon } from '@/shared/ui';
import { useRecurringTeaser } from './composables/useRecurringTeaser.ts';

const { view } = useRecurringTeaser();
</script>

<template>
  <!-- Home: the monthly total of regular payments; the whole line opens their screen. -->
  <VCard v-if="view" as="section" padding="none" :aria-label="$t('recurring.title')">
    <RouterLink
      :to="{ name: ROUTE.recurring }"
      class="flex items-center gap-3 rounded-[inherit] px-4 py-3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
    >
      <VIcon icon="lucide:repeat" class="size-4 shrink-0 text-foreground-muted" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-sm font-semibold">{{ $t('recurring.title') }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ view.caption }}</span>
      </span>
      <span class="flex shrink-0 items-baseline gap-1.5">
        <span class="font-bold tabular-nums">{{ view.total }}</span>
        <span class="text-sm text-foreground-secondary">{{ $t('recurring.perMonth') }}</span>
      </span>
      <VIcon icon="lucide:chevron-right" class="size-4 shrink-0 text-foreground-muted" />
    </RouterLink>
  </VCard>
</template>

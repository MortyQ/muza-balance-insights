<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { VCard, VIcon } from '@/shared/ui';
import { SEVERITY_CHIP } from '../constants.ts';
import type { SignalCardView } from '../types.ts';

// A new payee or a one-off in the feed: the payee, what it is and its category, the amount, its severity; it opens the
// category when there is one.
const { signal } = defineProps<{ signal: SignalCardView }>();
</script>

<template>
  <VCard as="article" padding="md" :data-test="`signal-card-${signal.severity}`">
    <component
      :is="signal.to ? RouterLink : 'div'"
      :to="signal.to ?? undefined"
      class="-m-1 flex items-center gap-3 rounded-lg p-1"
      :class="{ 'hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': signal.to }"
      data-test="signal-row"
    >
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken">
        <VIcon :icon="signal.icon" class="size-4 text-foreground-muted" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semibold">{{ signal.name }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ signal.caption }}</span>
      </span>
      <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="SEVERITY_CHIP[signal.severity]" data-test="severity">{{ signal.severityLabel }}</span>
      <span class="shrink-0 text-sm font-semibold tabular-nums">{{ signal.amount }}</span>
    </component>
  </VCard>
</template>

<script setup lang="ts">
import { VIcon, VInfoNotice } from '@/shared/ui';

const { failed, note, importing, pendingHolds, empty, leftOut } = defineProps<{
  failed: boolean;
  /** `periodNote`: why the numbers may be partial or empty; null — the month is complete. */
  note: string | null;
  importing: boolean;
  pendingHolds: number;
  empty: boolean;
  leftOut: ReadonlyArray<string>;
}>();
</script>

<template>
  <VInfoNotice v-if="failed" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.spending.failed')" />
  <VInfoNotice v-else-if="note" :card="false" icon="lucide:info" tone="info" :subtitle="note" />
  <p v-if="importing" class="text-sm text-foreground-muted">{{ $t('home.spending.importing') }}</p>
  <p v-if="pendingHolds > 0" class="flex items-center gap-1.5 text-sm text-warning">
    <VIcon icon="lucide:clock" class="size-3.5 shrink-0" />
    {{ $t('home.spending.pending', { count: pendingHolds }) }}
  </p>
  <template v-if="empty">
    <p class="text-foreground-muted">{{ $t('home.spending.empty') }}</p>
    <p v-for="l in leftOut" :key="l" class="text-sm text-foreground-muted">{{ l }}</p>
  </template>
</template>

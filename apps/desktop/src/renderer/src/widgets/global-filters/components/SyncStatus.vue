<script setup lang="ts">
import { VIcon, VTooltip } from '@/shared/ui';
import type { SyncStatusView } from '../types.ts';

const { view } = defineProps<{ view: Readonly<SyncStatusView> }>();
</script>

<template>
  <!-- Only `text` and `note` are announced: the percent is aria-hidden, so a screen reader hears a phase once, not
       every tick. -->
  <VTooltip :text="view.tooltip" :disabled="!view.tooltip" placement="bottom" tooltip-class="whitespace-pre-line" wrapper-class="ml-auto">
    <span role="status" aria-live="polite" class="flex items-center gap-1.5 text-sm text-foreground-muted tabular-nums">
      <VIcon v-if="view.icon === 'spinner'" icon="lucide:loader-circle" :size="14" class="animate-spin motion-reduce:animate-none" />
      <VIcon v-else-if="view.icon === 'warning'" icon="lucide:triangle-alert" :size="14" class="text-warning" />
      <span>{{ view.text }}</span>
      <span v-if="view.percent" aria-hidden="true">{{ view.percent }}</span>
      <span v-if="view.note" class="sr-only">{{ view.note }}</span>
    </span>
  </VTooltip>
</template>

<script setup lang="ts">
import { VTooltip } from '@/shared/ui';

// Pending holds left out of a limit's figures: a quiet «+ 2 pending, 650 ₴», the hint on hover.
const { note } = defineProps<{ note: { text: string; hint: string } }>();
</script>

<template>
  <VTooltip :text="note.hint" placement="top">
    <span class="text-xs text-foreground-muted tabular-nums underline decoration-dotted underline-offset-2" tabindex="0" data-test="pending-note">{{ note.text }}</span>
  </VTooltip>
</template>

<script setup lang="ts">
import { VTooltip } from '@/shared/ui';
import { OPS_TONE } from '../constants.ts';
import type { OpsDiffView } from '../types.ts';

const { diff } = defineProps<{ diff: OpsDiffView }>();
</script>

<template>
  <VTooltip v-if="diff.hint" :text="diff.hint" placement="top" tabindex="0" wrapper-class="inline-flex">
    <span class="font-bold tabular-nums" :class="OPS_TONE[diff.tone]">{{ diff.text }}<span class="sr-only">: {{ diff.hint }}</span></span>
  </VTooltip>
  <span v-else class="font-bold tabular-nums" :class="OPS_TONE[diff.tone]">{{ diff.text }}<span v-if="diff.sr" class="sr-only"> {{ diff.sr }}</span></span>
</template>

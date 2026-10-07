<script setup lang="ts">
import { OPS_TONE } from '../constants.ts';
import type { OpsDiffView } from '../types.ts';

const { diff } = defineProps<{ diff: OpsDiffView }>();
</script>

<template>
  <span class="font-bold tabular-nums" :class="OPS_TONE[diff.tone]">{{ diff.text }}<span v-if="diff.sr" class="sr-only"> {{ diff.sr }}</span></span>
</template>

<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import { STATE_LOOK, type StateLookName } from '../constants.ts';

const { state, text } = defineProps<{ state: StateLookName; text: string }>();
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" :class="STATE_LOOK[state].chip" data-test="limit-state">
    <VIcon :icon="STATE_LOOK[state].icon" class="size-3.5" />
    {{ text }}
  </span>
</template>

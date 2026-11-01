<script setup lang="ts">
import type { LimitStateName } from '@contract/api.ts';
import { VIcon } from '@/shared/ui';
import { STATE_LOOK } from '../constants.ts';

const { state, text } = defineProps<{ state: LimitStateName; text: string }>();
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" :class="STATE_LOOK[state].chip" data-test="limit-state">
    <VIcon :icon="STATE_LOOK[state].icon" class="size-3.5" />
    {{ text }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { VTooltip } from '@/shared/ui';
import { compareText } from '../utils.ts';

const { from, to, thisMonth, dataFrom } = defineProps<{ from: string; to: string; thisMonth: string; dataFrom: string | null }>();
const note = computed(() => compareText({ from, to }, thisMonth, dataFrom));
</script>

<template>
  <VTooltip v-if="note.comparable" :text="$t('entities.period.compareHint')" placement="top" tabindex="0" wrapper-class="mt-0.5 text-foreground-muted">
    <span class="underline decoration-dotted underline-offset-2">{{ note.compare }}</span><span class="sr-only">: {{ $t('entities.period.compareHint') }}</span>
  </VTooltip>
  <div v-else class="mt-0.5 text-foreground-muted">{{ note.compare }}</div>
  <div v-if="note.running" class="mt-0.5 text-warning">{{ note.running }}</div>
</template>

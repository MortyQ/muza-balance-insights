<script setup lang="ts">
import { VCard, VHelpHint } from '@/shared/ui';
import type { KpiView } from '../types.ts';

const { items } = defineProps<{ items: ReadonlyArray<KpiView> }>();
const TONE: Readonly<Record<KpiView['tone'], string>> = { good: 'text-success', bad: 'text-danger', neutral: 'text-foreground-muted' };
</script>

<template>
  <div class="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
    <VCard v-for="(k, i) in items" :key="k.key" padding="md" data-test="kpi">
      <div class="flex items-center gap-1 text-sm text-foreground-muted">
        {{ k.label }}
        <VHelpHint v-if="i === 0" :label="$t('common.helpLabel', { name: $t('analytics.help.kpisName') })">{{ $t('analytics.help.kpis') }}</VHelpHint>
      </div>
      <div class="mt-1 text-xl font-bold tabular-nums">{{ k.value }}</div>
      <div v-if="k.note" class="mt-1 text-xs" :class="TONE[k.tone]">{{ k.note }}</div>
    </VCard>
  </div>
</template>

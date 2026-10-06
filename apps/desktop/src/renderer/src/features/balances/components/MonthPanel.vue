<script setup lang="ts">
import { computed } from 'vue';
import { ROUTE } from '@/shared/config';
import { VButton } from '@/shared/ui';
import type { Flow, LegendItem } from '../types.ts';
import { spentShare } from '../utils.ts';
import FlowBars from './FlowBars.vue';

const { title, note, flow, legend, stubShown } = defineProps<{
  /** «September», «December 2025». */
  title: string;
  /** «whole month» / «from 14 June» / «to 27 Sep». */
  note: string;
  flow: Flow;
  /** People of the family view; empty for a person. */
  legend: ReadonlyArray<LegendItem>;
  stubShown: boolean;
}>();
const emit = defineEmits<{ stub: [] }>();

const spent = computed(() => spentShare(flow.income, flow.spending));
</script>

<template>
  <div class="flex flex-col justify-center gap-4">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-base font-bold">{{ title }}</h3>
      <span class="text-xs text-foreground-muted">{{ note }}<template v-if="spent !== null"> · {{ $t('home.balances.spentShare', { spent }) }}</template></span>
    </div>
    <div class="flex flex-col gap-2">
      <FlowBars :flow size="md" :income-to="{ name: ROUTE.income }" />
      <p v-if="flow.note" class="line-clamp-2 text-xs text-foreground-muted" :title="flow.note">{{ flow.note }}</p>
    </div>
    <ul v-if="legend.length > 0" class="flex flex-wrap gap-x-4.5 gap-y-2" :aria-label="$t('home.balances.people')">
      <li v-for="p in legend" :key="p.participantId" class="inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
        <span class="size-2 rounded-full bg-(--c)" :style="{ '--c': p.color }" aria-hidden="true" />
        {{ p.label }}
      </li>
    </ul>
    <div class="flex items-center gap-2.5">
      <VButton variant="primary" size="md" :text="$t('home.balances.allAccounts')" @click="emit('stub')" />
      <span v-if="stubShown" class="text-xs text-foreground-muted" role="status">{{ $t('home.balances.stubSoon') }}</span>
    </div>
  </div>
</template>

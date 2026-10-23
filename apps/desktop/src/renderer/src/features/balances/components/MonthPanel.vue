<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ROUTE, incomeLink } from '@/shared/config';
import { VButton, VIcon } from '@/shared/ui';
import type { Flow, LegendItem } from '../types.ts';
import { reservedLine, savedLine, signedMoney, spentShare } from '../utils.ts';
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
const saved = computed(() => savedLine(flow));
const reserved = computed(() => reservedLine(flow));
const result = computed(() => {
  const value = flow.income - flow.spending;
  return { value, text: signedMoney(value, flow.currency, value < 0 ? '−' : '+') };
});
</script>

<template>
  <div class="flex flex-col justify-center gap-4">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-base font-bold">{{ $t('home.balances.monthTile') }}</h3>
      <span class="text-xs text-foreground-muted">{{ title }} · {{ note }}</span>
    </div>
    <div class="flex flex-col gap-2">
      <FlowBars :flow size="md" :income-to="incomeLink()" />
      <!-- The month's result under a dashed line, as on the home mockup. -->
      <p class="mt-1 flex justify-between gap-3 border-t border-dashed border-border pt-2.5 text-sm" data-test="month-result">
        <span class="text-foreground-secondary">{{ $t('home.balances.monthResult') }}</span>
        <span class="font-bold tabular-nums" :class="result.value > 0 ? 'text-success' : result.value < 0 ? 'text-negative-soft' : ''">{{ result.text }}</span>
      </p>
      <p v-if="spent !== null" class="text-xs text-foreground-muted">{{ $t('home.balances.spentShare', { spent }) }}</p>
      <p v-if="saved" class="flex justify-between text-sm">
        <span class="text-foreground-secondary">{{ saved.label }}</span>
        <span class="font-bold tabular-nums">{{ saved.amount }}</span>
      </p>
      <RouterLink
        v-if="reserved"
        :to="{ name: ROUTE.planning }"
        class="-mx-1.5 flex items-center justify-between gap-2 rounded-md px-1.5 text-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
      >
        <span class="text-foreground-secondary">{{ reserved.label }}</span>
        <span class="inline-flex items-center gap-1 font-bold tabular-nums">
          {{ reserved.amount }}
          <VIcon icon="lucide:chevron-right" class="size-3.5 text-foreground-muted" />
        </span>
      </RouterLink>
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

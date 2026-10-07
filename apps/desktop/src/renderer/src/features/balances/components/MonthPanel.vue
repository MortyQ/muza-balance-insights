<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ROUTE, incomeLink } from '@/shared/config';
import { VButton, VIcon } from '@/shared/ui';
import type { Flow, LegendItem } from '../types.ts';
import { reservedLine, savedLine, spentShare } from '../utils.ts';
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
</script>

<template>
  <div class="flex flex-col justify-center gap-4">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-base font-bold">{{ title }}</h3>
      <span class="text-xs text-foreground-muted">{{ note }}<template v-if="spent !== null"> · {{ $t('home.balances.spentShare', { spent }) }}</template></span>
    </div>
    <div class="flex flex-col gap-2">
      <FlowBars :flow size="md" :income-to="incomeLink()" />
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

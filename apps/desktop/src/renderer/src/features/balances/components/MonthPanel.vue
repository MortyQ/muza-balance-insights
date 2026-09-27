<script setup lang="ts">
import { computed } from 'vue';
import { VButton } from '@/shared/ui';
import type { Flow, LegendItem } from '../types.ts';
import { spentShare } from '../utils.ts';
import FlowBars from './FlowBars.vue';

const { title, note, flow, legend, stubShown } = defineProps<{
  /** «Сентябрь», «Декабрь 2025». */
  title: string;
  /** «весь месяц» / «с 14 июня» / «по 27 сен». */
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
      <span class="text-xs text-foreground-muted">{{ note }}<template v-if="spent !== null"> · потрачено {{ spent }}% прихода</template></span>
    </div>
    <div class="flex flex-col gap-2">
      <FlowBars :flow size="md" />
      <p v-if="flow.note" class="line-clamp-2 text-xs text-foreground-muted" :title="flow.note">{{ flow.note }}</p>
    </div>
    <ul v-if="legend.length > 0" class="flex flex-wrap gap-x-4.5 gap-y-2" aria-label="Люди">
      <li v-for="p in legend" :key="p.participantId" class="inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
        <span class="size-2 rounded-full bg-(--c)" :style="{ '--c': p.color }" aria-hidden="true" />
        {{ p.label }}
      </li>
    </ul>
    <div class="flex items-center gap-2.5">
      <VButton variant="primary" size="md" text="Все счета" @click="emit('stub')" />
      <span v-if="stubShown" class="text-xs text-foreground-muted" role="status">Раздел появится позже</span>
    </div>
  </div>
</template>

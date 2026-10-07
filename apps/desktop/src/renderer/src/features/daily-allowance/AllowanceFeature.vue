<script setup lang="ts">
import { ref, useId } from 'vue';
import { VCard, VCollapse, VIcon } from '@/shared/ui';
import AllowanceBreakdown from './components/AllowanceBreakdown.vue';
import ReserveField from './components/ReserveField.vue';
import { useAllowance } from './composables/useAllowance.ts';

const { visible, view, reserve, setReserve } = useAllowance();
const open = ref(false);
const failed = ref(false);
const panelId = useId();

async function save(hryvnias: number) {
  failed.value = !(await setReserve(hryvnias));
}
</script>

<template>
  <VCard v-if="visible && view" as="section" padding="none" :aria-label="$t('home.allowance.title')">
    <div class="flex flex-col gap-1 px-4 py-3">
      <h3 class="text-xs font-semibold text-foreground-muted">{{ $t('home.allowance.title') }}</h3>
      <p class="flex flex-wrap items-baseline gap-x-2">
        <span class="text-2xl font-bold tabular-nums" :class="{ 'text-danger': view.short }">{{ view.amount }}</span>
        <span class="text-sm text-foreground-secondary">{{ view.short ? $t('home.allowance.short') : view.until }}</span>
      </p>
      <p v-if="view.short" class="text-xs text-foreground-muted">{{ view.until }}</p>
      <p class="text-xs text-foreground-muted">{{ view.income }}</p>
    </div>
    <button
      type="button"
      class="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-border-subtle px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      {{ $t('home.allowance.toggle') }}
      <VIcon icon="lucide:chevron-down" class="size-3.5 transition-transform motion-reduce:transition-none" :class="{ 'rotate-180': open }" />
    </button>
    <VCollapse :id="panelId" v-model="open" unmount>
      <div class="flex flex-col gap-4 border-t border-border-subtle px-4 pt-3 pb-4" role="region" :aria-label="$t('home.allowance.toggle')">
        <AllowanceBreakdown :lines="view.lines" />
        <p v-if="view.leftOut" class="text-xs text-foreground-muted">{{ view.leftOut }}</p>
        <p class="text-xs text-foreground-muted">{{ $t('home.allowance.note') }}</p>
        <ReserveField :saved="reserve" :failed @save="save" />
      </div>
    </VCollapse>
  </VCard>
</template>

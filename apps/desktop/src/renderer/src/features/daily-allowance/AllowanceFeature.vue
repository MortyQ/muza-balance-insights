<script setup lang="ts">
import { ref } from 'vue';
import { VCard } from '@/shared/ui';
import AllowanceBreakdown from './components/AllowanceBreakdown.vue';
import ReserveField from './components/ReserveField.vue';
import { useAllowance } from './composables/useAllowance.ts';

const { visible, view, reserve, setReserve } = useAllowance();
const failed = ref(false);

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
    <!-- How it is counted: always open on the planning screen, the reserve is set right there. -->
    <div class="flex flex-col gap-4 border-t border-border-subtle px-4 pt-3 pb-4" role="region" :aria-label="$t('home.allowance.toggle')">
      <AllowanceBreakdown :lines="view.lines" />
      <p v-if="view.leftOut" class="text-xs text-foreground-muted">{{ view.leftOut }}</p>
      <p class="text-xs text-foreground-muted">{{ $t('home.allowance.note') }}</p>
      <ReserveField :saved="reserve" :failed @save="save" />
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MoneyFormat } from '@/entities/currency-display';
import { VChart } from '@/shared/ui';
import type { PaceView } from '../types.ts';
import { paceChartOption } from '../utils.ts';

const { view, fmt } = defineProps<{ view: Readonly<PaceView>; fmt: Readonly<MoneyFormat> }>();

const option = computed(() => paceChartOption(view, (n) => fmt.money(n)));
</script>

<template>
  <!-- The month pace (spec desktop-balance-cards): the month's spending added up by day against a usual month. -->
  <div class="flex min-w-0 flex-col gap-3">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 class="text-base font-bold">{{ $t('home.balances.pace.title') }}</h3>
      <span class="text-xs text-foreground-muted">{{ $t('home.balances.pace.subtitle') }}</span>
    </div>
    <div class="h-44 min-h-0 flex-1" role="img" :aria-label="$t('home.balances.pace.chart')">
      <VChart :option class="size-full" />
    </div>
    <div class="flex flex-wrap gap-x-8 gap-y-2">
      <div data-test="pace-figure">
        <div class="text-xs text-foreground-muted">{{ $t('home.balances.pace.spent') }}</div>
        <div class="font-bold tabular-nums">{{ fmt.money(view.spentTotal) }}</div>
      </div>
      <div v-if="view.usualByNow !== null" data-test="pace-figure">
        <div class="text-xs text-foreground-muted">{{ $t(view.running ? 'home.balances.pace.usualByNow' : 'home.balances.pace.usualMonth') }}</div>
        <div class="font-bold tabular-nums">{{ fmt.money(view.usualByNow) }}</div>
      </div>
      <div v-if="view.perDay !== null" data-test="pace-figure">
        <div class="text-xs text-foreground-muted">{{ $t('home.balances.pace.perDay') }}</div>
        <div class="font-bold text-primary tabular-nums">{{ fmt.money(view.perDay) }}</div>
      </div>
    </div>
    <p v-if="view.usual === null" class="text-xs text-foreground-muted" data-test="pace-no-usual">{{ $t('home.balances.pace.noUsual') }}</p>
  </div>
</template>

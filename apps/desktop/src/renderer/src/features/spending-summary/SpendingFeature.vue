<script setup lang="ts">
import { currencyAlpha } from '@mono/core/currency';
import { formatMoney, monthTitle, shiftMonth } from '@/shared/lib';
import { VButton, VButtonGroup, VCard, VInfoNotice, VSegmentedControl } from '@/shared/ui';
import SpendingTable from './components/SpendingTable.vue';
import { useSpending } from './composables/useSpending.ts';
import { SCOPES } from './constants.ts';

const { thisMonth, month, scope, state, view, periodNote } = useSpending();
</script>

<template>
  <VCard title="Траты" padding="md">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <VButtonGroup aria-label="Месяц">
            <VButton variant="neutral" icon="lucide:chevron-left" aria-label="Предыдущий месяц" @click="month = shiftMonth(month, -1)" />
            <VButton variant="neutral" icon="lucide:chevron-right" aria-label="Следующий месяц" :disabled="month >= thisMonth" @click="month = shiftMonth(month, 1)" />
          </VButtonGroup>
          <span class="inline-block text-lg font-semibold first-letter:uppercase">{{ monthTitle(month) }}</span>
          <VButton v-if="month !== thisMonth" variant="link" text="Текущий месяц" @click="month = thisMonth" />
        </div>
        <VSegmentedControl v-model="scope" :options="SCOPES" />
      </div>

      <VInfoNotice
        v-if="state.status === 'error'"
        :card="false"
        icon="lucide:circle-alert"
        tone="danger"
        subtitle="Не удалось посчитать траты. Попробуй ещё раз или перезапусти приложение."
      />
      <VInfoNotice v-else-if="periodNote" :card="false" icon="lucide:info" tone="info" :subtitle="periodNote" />
      <p v-if="view && view.period.pendingHolds > 0" class="text-sm text-foreground-muted">
        Операций в обработке банком: {{ view.period.pendingHolds }} — их суммы ещё могут измениться.
      </p>

      <p v-if="view && state.status !== 'error' && view.currencies.length === 0 && view.period.dataUntil !== null" class="text-foreground-muted">
        Трат за этот месяц нет.
      </p>

      <div v-for="c in view?.currencies ?? []" :key="c.currency" class="flex flex-col gap-2" :class="{ 'opacity-60': state.status === 'loading' }">
        <h3 v-if="(view?.currencies.length ?? 0) > 1" class="text-sm font-medium text-foreground-secondary">Счета в {{ currencyAlpha(c.currency) }}</h3>
        <SpendingTable :currency="c" />
        <p v-if="c.total.netPerDay !== null && view" class="text-sm text-foreground-muted">
          В среднем {{ formatMoney(c.total.netPerDay, c.currency) }} в день
          <template v-if="view.period.coveredDays < view.period.days">(по {{ view.period.coveredDays }} полным дням с данными)</template>
        </p>
      </div>

      <p v-if="view?.currencies.length" class="text-sm text-foreground-muted">
        Брутто — все списания, возвраты — вернувшиеся деньги, нетто = брутто − возвраты. Переводы между своими счетами и
        поступления в траты не входят. Разные валюты не складываются.
      </p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BalanceApi, Scope, SpendingView } from '../../../shared/api.ts';
import { currencyAlpha } from '@mono/core/currency';
import { formatMoney } from '../lib/money.ts';
import { kyivToday, monthOf, monthRange, monthTitle, shiftMonth, shortDate, type YearMonth } from '../lib/months.ts';
import { VButton, VButtonGroup, VCard, VInfoNotice, VSegmentedControl, type SegmentOption } from '../ui/index.ts';

const { api, refreshKey } = defineProps<{ api: BalanceApi; /** Bumped by the parent after an import or a delete. */ refreshKey: number }>();

const thisMonth = monthOf(kyivToday(new Date()));
const month = ref<YearMonth>(thisMonth);
const scope = ref<Scope>('personal');
const scopes: SegmentOption<Scope>[] = [
  { label: 'Личное', value: 'personal' },
  { label: 'Бизнес', value: 'business' },
];

const view = ref<SpendingView | null>(null);
const failed = ref(false);
const loading = ref(false);
let request = 0;

async function load() {
  const id = ++request;
  loading.value = true;
  try {
    const v = await api.spendingSummary({ ...monthRange(month.value), scope: scope.value });
    if (id !== request) return; // a newer month / scope was asked for meanwhile
    view.value = v;
    failed.value = false;
  } catch {
    if (id === request) failed.value = true;
  } finally {
    if (id === request) loading.value = false;
  }
}
watch([month, scope, () => refreshKey], load, { immediate: true });

const periodNote = computed(() => {
  const p = view.value?.period;
  if (!p) return null;
  if (p.dataUntil === null) return 'Данных пока нет: загрузи выписку в разделе «Импорт».';
  if (p.dataUntil < p.from) return `Данные загружены только до ${shortDate(p.dataUntil)}: за этот месяц их ещё нет.`;
  if (!p.incomplete) return null;
  return `Месяц неполный: данные до ${shortDate(p.dataUntil)}, цифры ещё вырастут.`;
});

/** Bar length: share of the largest net in that currency (refund-only categories draw no bar). */
function share(net: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (net / max) * 100)) : 0;
}
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
        <VSegmentedControl v-model="scope" :options="scopes" />
      </div>

      <VInfoNotice v-if="failed" :card="false" icon="lucide:circle-alert" tone="danger" subtitle="Не удалось посчитать траты. Попробуй ещё раз или перезапусти приложение." />
      <VInfoNotice v-else-if="periodNote" :card="false" icon="lucide:info" tone="info" :subtitle="periodNote" />
      <p v-if="view && view.period.pendingHolds > 0" class="text-sm text-foreground-muted">
        Операций в обработке банком: {{ view.period.pendingHolds }} — их суммы ещё могут измениться.
      </p>

      <p v-if="view && !failed && view.currencies.length === 0 && view.period.dataUntil !== null" class="text-foreground-muted">
        Трат за этот месяц нет.
      </p>

      <div v-for="c in view?.currencies ?? []" :key="c.currency" class="flex flex-col gap-2" :class="{ 'opacity-60': loading }">
        <h3 v-if="(view?.currencies.length ?? 0) > 1" class="text-sm font-medium text-foreground-secondary">Счета в {{ currencyAlpha(c.currency) }}</h3>
        <table class="w-full border-collapse tabular-nums">
          <thead>
            <tr class="text-left text-sm text-foreground-muted">
              <th class="py-1 pr-3 font-medium">Категория</th>
              <th class="w-[34%] py-1 pr-3 font-medium"><span class="sr-only">Доля</span></th>
              <th class="py-1 pr-3 text-right font-medium">Брутто</th>
              <th class="py-1 pr-3 text-right font-medium">Возвраты</th>
              <th class="py-1 text-right font-medium">Нетто</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in c.categories" :key="row.category" class="border-t border-border-subtle">
              <td class="py-1.5 pr-3 first-letter:uppercase">{{ row.category }}</td>
              <td class="py-1.5 pr-3">
                <svg class="block h-2 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                  <rect width="100" height="8" rx="2" class="fill-surface-sunken" />
                  <rect :width="share(row.net, c.categories[0]?.net ?? 0)" height="8" rx="2" class="fill-primary" />
                </svg>
              </td>
              <td class="py-1.5 pr-3 text-right text-foreground-secondary">{{ formatMoney(row.gross, c.currency) }}</td>
              <td class="py-1.5 pr-3 text-right text-foreground-secondary">{{ row.refunds ? formatMoney(row.refunds, c.currency) : '—' }}</td>
              <td class="py-1.5 text-right font-medium">{{ formatMoney(row.net, c.currency) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-border font-semibold">
              <td class="py-2 pr-3" colspan="2">Итого</td>
              <td class="py-2 pr-3 text-right">{{ formatMoney(c.total.gross, c.currency) }}</td>
              <td class="py-2 pr-3 text-right">{{ c.total.refunds ? formatMoney(c.total.refunds, c.currency) : '—' }}</td>
              <td class="py-2 text-right">{{ formatMoney(c.total.net, c.currency) }}</td>
            </tr>
          </tfoot>
        </table>
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

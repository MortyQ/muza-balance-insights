<script setup lang="ts">
import { ref, watch } from 'vue';
import type { BalanceLine, BalancesView, BalanceApi } from '../../../shared/api.ts';
import { formatMoney } from '../lib/money.ts';
import { shortDate } from '../lib/months.ts';
import { VCard, VInfoNotice } from '../ui/index.ts';

const { api, refreshKey } = defineProps<{ api: BalanceApi; refreshKey: number }>();

const view = ref<BalancesView | null>(null);
const failed = ref(false);

async function load() {
  try {
    view.value = await api.getBalances();
    failed.value = false;
  } catch {
    failed.value = true;
  }
}
watch(() => refreshKey, load, { immediate: true });

const updated = (lines: BalanceLine[]) => lines.map((l) => l.updatedAt).sort().at(-1);
</script>

<template>
  <VCard title="Балансы" padding="md">
    <div class="flex flex-col gap-4">
      <VInfoNotice v-if="failed" :card="false" icon="lucide:circle-alert" tone="danger" subtitle="Не удалось прочитать балансы." />
      <p v-else-if="view && view.cards.length === 0" class="text-foreground-muted">Счетов пока нет: загрузи выписку в разделе «Импорт».</p>

      <template v-if="view && view.cards.length > 0">
        <div class="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
          <div v-for="a in view.cards" :key="a.id" class="flex flex-col gap-1 rounded-md border border-border-subtle bg-surface-raised p-3">
            <span class="text-sm text-foreground-muted">{{ a.label }}</span>
            <span class="text-xl font-semibold tabular-nums" :class="{ 'text-danger': a.ownFunds < 0 }">
              {{ formatMoney(a.ownFunds, a.currency, { minorUnits: true }) }}
            </span>
            <span v-if="a.creditLimit > 0" class="text-sm text-foreground-muted tabular-nums">
              кредитный лимит {{ formatMoney(a.creditLimit, a.currency) }}
            </span>
          </div>
        </div>

        <div v-if="view.jars.length > 0" class="flex flex-col gap-1">
          <h3 class="text-sm font-medium text-foreground-secondary">Банки</h3>
          <ul class="flex flex-col">
            <li v-for="j in view.jars" :key="j.id" class="flex justify-between border-t border-border-subtle py-1.5 tabular-nums">
              <span>{{ j.label }}</span>
              <span class="font-medium">{{ formatMoney(j.ownFunds, j.currency, { minorUnits: true }) }}</span>
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 tabular-nums">
          <span class="text-foreground-secondary">Всего своих денег:</span>
          <span v-for="t in view.totals" :key="t.currency" class="font-semibold">{{ formatMoney(t.ownFunds, t.currency, { minorUnits: true }) }}</span>
        </div>
        <p class="text-sm text-foreground-muted">
          Свои деньги — баланс без кредитного лимита; минус — долг по кредитке. Банки входят в итог. Балансы на
          {{ shortDate(updated([...view.cards, ...view.jars]) ?? '') }}, обновляются при импорте.
        </p>
      </template>
    </div>
  </VCard>
</template>

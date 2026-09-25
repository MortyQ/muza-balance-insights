<script setup lang="ts">
import type { SpendingCurrency } from '@contract/api.ts';
import { formatMoney } from '@/shared/lib';
import { share } from '../utils.ts';

const { currency } = defineProps<{ currency: Readonly<SpendingCurrency> }>();
</script>

<template>
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
      <tr v-for="row in currency.categories" :key="row.category" class="border-t border-border-subtle">
        <td class="py-1.5 pr-3 first-letter:uppercase">{{ row.category }}</td>
        <td class="py-1.5 pr-3">
          <svg class="block h-2 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect width="100" height="8" rx="2" class="fill-surface-sunken" />
            <rect :width="share(row.net, currency.categories[0]?.net ?? 0)" height="8" rx="2" class="fill-primary" />
          </svg>
        </td>
        <td class="py-1.5 pr-3 text-right text-foreground-secondary">{{ formatMoney(row.gross, currency.currency) }}</td>
        <td class="py-1.5 pr-3 text-right text-foreground-secondary">{{ row.refunds ? formatMoney(row.refunds, currency.currency) : '—' }}</td>
        <td class="py-1.5 text-right font-medium">{{ formatMoney(row.net, currency.currency) }}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="border-t border-border font-semibold">
        <td class="py-2 pr-3" colspan="2">Итого</td>
        <td class="py-2 pr-3 text-right">{{ formatMoney(currency.total.gross, currency.currency) }}</td>
        <td class="py-2 pr-3 text-right">{{ currency.total.refunds ? formatMoney(currency.total.refunds, currency.currency) : '—' }}</td>
        <td class="py-2 text-right">{{ formatMoney(currency.total.net, currency.currency) }}</td>
      </tr>
    </tfoot>
  </table>
</template>

<script setup lang="ts">
import { MoneyStack } from '@/entities/currency-display';
import { VHelpHint } from '@/shared/ui';
import type { ExpectedIncomeView } from '../types.ts';

const { expected } = defineProps<{ expected: ReadonlyArray<ExpectedIncomeView> }>();
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-1">
      <h2 class="text-base font-bold">{{ $t('income.regular.expected') }}</h2>
      <VHelpHint :label="$t('common.helpLabel', { name: $t('income.regular.expected') })">{{ $t('income.regular.expectedHelp') }}</VHelpHint>
    </div>
    <p v-if="expected.length === 0" class="text-sm text-foreground-muted">{{ $t('income.regular.expectedNone') }}</p>
    <ul v-else class="flex flex-col divide-y divide-border-subtle">
      <li v-for="e in expected" :key="e.key" class="flex items-center gap-3 py-2" data-test="expected-income">
        <span class="flex min-w-0 grow flex-col">
          <span class="truncate font-semibold" :title="e.name">{{ e.name }}</span>
          <span class="text-xs text-foreground-muted">{{ e.date }}</span>
        </span>
        <MoneyStack :amount="e.amount" :also="e.also" />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { BANKS, type Bank, BankMark, OTHER_BANKS } from '@/entities/bank';

const emit = defineEmits<{ select: [bank: Readonly<Bank>] }>();

const TILE =
  'group flex flex-col items-start gap-3 rounded-xl border border-border-subtle bg-surface p-4 text-left shadow-xs transition-[transform,border-color,box-shadow] duration-150 ease-out focus-visible:border-border-focus focus-visible:outline-none enabled:hover:border-border enabled:hover:shadow-sm enabled:active:scale-[0.97] disabled:cursor-default disabled:shadow-none motion-reduce:transition-none';
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
    <button v-for="bank in BANKS" :key="bank.id" type="button" :class="TILE" @click="emit('select', bank)">
      <BankMark :bank size="lg" />
      <span class="font-semibold">{{ bank.name }}</span>
      <span class="text-sm text-foreground-muted">
        {{ bank.ways.includes('token') ? $t('integrations.picker.available') : $t('integrations.picker.files') }}
      </span>
    </button>
    <!-- Not a bank: the ones the app cannot connect yet. -->
    <button type="button" disabled :class="TILE">
      <BankMark :bank="OTHER_BANKS" size="lg" />
      <span class="flex w-full items-center justify-between gap-2">
        <span class="font-semibold text-foreground-muted">{{ $t(OTHER_BANKS.name) }}</span>
        <span class="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-foreground-muted">{{ $t('integrations.picker.soon') }}</span>
      </span>
      <span class="text-sm text-foreground-muted">{{ $t('integrations.picker.later') }}</span>
    </button>
  </div>
</template>

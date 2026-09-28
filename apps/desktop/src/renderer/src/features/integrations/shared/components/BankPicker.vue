<script setup lang="ts">
import { BANKS, type Bank, BankMark } from '@/entities/bank';

const emit = defineEmits<{ select: [bank: Readonly<Bank>] }>();
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
    <button
      v-for="bank in BANKS"
      :key="bank.id"
      type="button"
      :disabled="bank.status !== 'available'"
      class="group flex flex-col items-start gap-3 rounded-xl border border-border-subtle bg-surface p-4 text-left shadow-xs transition-[transform,border-color,box-shadow] duration-150 ease-out focus-visible:border-border-focus focus-visible:outline-none enabled:hover:border-border enabled:hover:shadow-sm enabled:active:scale-[0.97] disabled:cursor-default disabled:shadow-none motion-reduce:transition-none"
      @click="emit('select', bank)"
    >
      <BankMark :bank size="lg" />
      <span class="flex w-full items-center justify-between gap-2">
        <span class="font-semibold" :class="{ 'text-foreground-muted': bank.status !== 'available' }">{{ $t(bank.name) }}</span>
        <span v-if="bank.status === 'soon'" class="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-foreground-muted">Скоро</span>
      </span>
      <span class="text-sm text-foreground-muted">
        {{ bank.status === 'available' ? 'Личный токен, только чтение' : 'Подключение появится позже' }}
      </span>
    </button>
  </div>
</template>

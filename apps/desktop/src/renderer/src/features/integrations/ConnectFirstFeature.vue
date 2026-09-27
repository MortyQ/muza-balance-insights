<script setup lang="ts">
import { ref } from 'vue';
import { DISCLAIMER } from '@contract/about.ts';
import type { ProviderKey } from '@contract/api.ts';
import { type Bank, BankMark } from '@/entities/bank';
import { VButton } from '@/shared/ui';
import AddConnectionFeature from './AddConnectionFeature.vue';
import BankPicker from './shared/components/BankPicker.vue';
import { isProviderKey } from './utils.ts';

const emit = defineEmits<{ connected: [] }>();

const selected = ref<{ bank: Readonly<Bank>; provider: ProviderKey } | null>(null);

function select(bank: Readonly<Bank>) {
  if (isProviderKey(bank.id)) selected.value = { bank, provider: bank.id };
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold">Balance Insights</h1>
      <p class="text-foreground-secondary">Куда уходят деньги — по твоей выписке, на твоём компьютере.</p>
    </header>

    <Transition name="swap" mode="out-in">
      <section v-if="!selected" key="banks" class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold">Выбери банк</h2>
        <BankPicker @select="select" />
      </section>

      <section v-else key="token" class="flex flex-col gap-4">
        <div>
          <VButton variant="link" icon="lucide:chevron-left" text="Другой банк" @click="selected = null" />
        </div>
        <div class="flex items-center gap-3">
          <BankMark :bank="selected.bank" size="lg" />
          <div class="flex flex-col">
            <h2 class="text-lg font-semibold">{{ selected.bank.name }}</h2>
            <span class="text-sm text-foreground-muted">Токен даёт только чтение выписки и балансов и хранится на этом компьютере.</span>
          </div>
        </div>
        <AddConnectionFeature :provider="selected.provider" default-label="Я" autofocus @added="emit('connected')" />
      </section>
    </Transition>

    <p class="text-sm text-foreground-muted">{{ DISCLAIMER }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { DISCLAIMER } from '@contract/about.ts';
import { BANKS, type Bank, BankMark } from '@/entities/bank';
import { VButton } from '@/shared/ui';
import AddConnectionForm from './components/AddConnectionForm.vue';
import BankCard from './components/BankCard.vue';

const emit = defineEmits<{ connected: [] }>();

const selected = ref<Readonly<Bank> | null>(null);
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
        <div class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
          <BankCard v-for="bank in BANKS" :key="bank.id" :bank @select="selected = $event" />
        </div>
      </section>

      <section v-else key="token" class="flex flex-col gap-4">
        <div>
          <VButton variant="link" icon="lucide:chevron-left" text="Другой банк" @click="selected = null" />
        </div>
        <div class="flex items-center gap-3">
          <BankMark :bank="selected" size="lg" />
          <div class="flex flex-col">
            <h2 class="text-lg font-semibold">{{ selected.name }}</h2>
            <span class="text-sm text-foreground-muted">Токен даёт только чтение выписки и балансов и хранится на этом компьютере.</span>
          </div>
        </div>
        <AddConnectionForm default-label="Я" autofocus @added="emit('connected')" />
      </section>
    </Transition>

    <p class="text-sm text-foreground-muted">{{ DISCLAIMER }}</p>
  </div>
</template>

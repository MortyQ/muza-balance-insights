<script setup lang="ts">
import { useRouter } from 'vue-router';
import { BankConnectionFeature } from '@/features/connect-bank';
import { DeleteDataFeature } from '@/features/delete-data';
import { ROUTE } from '@/shared/config';
import { VButton } from '@/shared/ui';
import { AboutApp } from '@/widgets/about-app';
import { useEscape } from './composables/useEscape.ts';

const router = useRouter();
// Home; the router guard sends it on to the connect screen when there is neither a token nor data.
const back = () => void router.replace({ name: ROUTE.home });
useEscape(back);
</script>

<template>
  <main class="mx-auto flex max-w-3xl flex-col gap-4 px-8 py-6">
    <header class="flex items-center gap-2">
      <VButton variant="neutral" icon="lucide:chevron-left" title="Назад (Esc)" aria-label="Назад" @click="back" />
      <h1 class="text-xl font-semibold">Настройки</h1>
    </header>
    <BankConnectionFeature />
    <DeleteDataFeature @deleted="back" />
    <AboutApp />
  </main>
</template>

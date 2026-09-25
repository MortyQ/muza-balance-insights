<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ConnectBankFeature } from '@/features/connect-bank';
import { ROUTE } from '@/shared/config';

const router = useRouter();
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-8 py-10">
    <ConnectBankFeature @connected="router.replace({ name: ROUTE.home })" />
  </main>
</template>

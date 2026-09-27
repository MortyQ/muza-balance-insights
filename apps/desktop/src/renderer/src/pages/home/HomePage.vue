<script setup lang="ts">
import { useSyncStatusStore } from '@/entities/sync-status';
import { UpdateBannerFeature } from '@/features/app-update';
import { BalancesFeature } from '@/features/balances';
import { ImportFeature } from '@/features/import-statement';
import { SpendingFeature } from '@/features/spending-summary';
import { HomeHeader } from '@/widgets/home-header';
import { HomeNotices } from '@/widgets/home-notices';

const syncStatus = useSyncStatusStore();
</script>

<template>
  <main class="mx-auto flex max-w-4xl flex-col gap-4 px-8 pt-3 pb-6">
    <HomeHeader />
    <HomeNotices />
    <UpdateBannerFeature />
    <template v-if="syncStatus.hasData">
      <SpendingFeature />
      <BalancesFeature />
    </template>
    <ImportFeature />
  </main>
</template>

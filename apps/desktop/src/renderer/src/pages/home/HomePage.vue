<script setup lang="ts">
import { useSyncStatusStore } from '@/entities/sync-status';
import { BalancesFeature } from '@/features/balances';
import { ImportFeature } from '@/features/import-statement';
import { NowStripFeature } from '@/features/now-strip';
import { AppLockHintFeature, UpdateBannerFeature } from '@/features/settings';
import { SpendingFeature } from '@/features/spending-summary';
import { GlobalFilters } from '@/widgets/global-filters';
import { HomeNotices } from '@/widgets/home-notices';

const syncStatus = useSyncStatusStore();
</script>

<template>
  <main class="mx-auto flex max-w-4xl flex-col gap-4 px-8 pt-1 pb-6">
    <GlobalFilters />
    <HomeNotices />
    <AppLockHintFeature />
    <UpdateBannerFeature />
    <template v-if="syncStatus.hasData">
      <BalancesFeature />
      <NowStripFeature />
      <SpendingFeature />
    </template>
    <ImportFeature />
  </main>
</template>

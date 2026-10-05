<script setup lang="ts">
import { useSyncStatusStore } from '@/entities/sync-status';
import { BalancesFeature } from '@/features/balances';
import { ImportFeature } from '@/features/import-statement';
import { NowStripFeature } from '@/features/now-strip';
import { AppLockHintFeature, UpdateBannerFeature } from '@/features/settings';
import { SpendingFeature } from '@/features/spending-summary';
import { HomeNotices } from '@/widgets/home-notices';

const syncStatus = useSyncStatusStore();
</script>

<template>
  <main class="flex flex-col gap-4">
    <!-- «General»: the blocks only; the filters and the side menu are the default layout's (app/layouts). -->
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

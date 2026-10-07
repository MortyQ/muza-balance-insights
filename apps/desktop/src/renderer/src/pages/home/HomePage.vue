<script setup lang="ts">
import { useSyncStatusStore } from '@/entities/sync-status';
import { BalancesFeature } from '@/features/balances';
import { AllowanceFeature } from '@/features/daily-allowance';
import { NowStripFeature } from '@/features/now-strip';
import { AppLockHintFeature, UpdateBannerFeature } from '@/features/settings';
import { SpendingFeature } from '@/features/spending-summary';
import { HomeNotices } from '@/widgets/home-notices';

const syncStatus = useSyncStatusStore();
</script>

<template>
  <main class="flex flex-col gap-4">
    <!-- «General»: the blocks only; the filters and the side menu are the default layout's (app/layouts). The history
         download is in settings, «Connections»: HomeNotices links there while there is no data. -->
    <HomeNotices />
    <AppLockHintFeature />
    <UpdateBannerFeature />
    <template v-if="syncStatus.hasData">
      <BalancesFeature />
      <AllowanceFeature />
      <NowStripFeature />
      <SpendingFeature />
    </template>
  </main>
</template>

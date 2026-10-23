<script setup lang="ts">
import { ref } from 'vue';
import { useSyncStatusStore } from '@/entities/sync-status';
import { BalancesFeature } from '@/features/balances';
import { NowStripFeature } from '@/features/now-strip';
import { RecurringTeaserFeature } from '@/features/recurring-payments';
import { AppLockHintFeature, UpdateBannerFeature } from '@/features/settings';
import { SpendingFeature } from '@/features/spending-summary';
import { HomeNotices } from '@/widgets/home-notices';

const syncStatus = useSyncStatusStore();
/** The «Now» details tile is open: it takes «What's unusual»'s place too. */
const nowDetails = ref(false);
</script>

<template>
  <main class="flex flex-col gap-4">
    <!-- «General»: the blocks only; the filters and the side menu are the default layout's (app/layouts). The history
         download is in settings, «Connections»: HomeNotices links there while there is no data. -->
    <HomeNotices />
    <AppLockHintFeature />
    <UpdateBannerFeature />
    <!-- The tile grid (spec desktop-home-tiles): one column, two from 47rem, three from 74rem of its own width. Features
         render their tiles straight into it (`contents` roots), in this order; each tile says its own span. -->
    <div v-if="syncStatus.hasData" class="@container">
      <div class="grid grid-cols-1 gap-4 @[47rem]:grid-cols-2 @[74rem]:grid-cols-[32rem_minmax(0,1.4fr)_minmax(17rem,1fr)]" data-test="home-grid">
        <BalancesFeature />
        <NowStripFeature v-model:details="nowDetails" />
        <SpendingFeature :insights-hidden="nowDetails" />
        <RecurringTeaserFeature />
      </div>
    </div>
  </main>
</template>

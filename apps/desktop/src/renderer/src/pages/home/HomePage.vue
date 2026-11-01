<script setup lang="ts">
import { ref } from 'vue';
import { useSyncStatusStore } from '@/entities/sync-status';
import { BalancesFeature } from '@/features/balances';
import { HomeBudgetFeature } from '@/features/home-budget';
import { HomeInsightsFeature, useHomeInsights } from '@/features/home-insights';
import { NowStripFeature } from '@/features/now-strip';
import { AppLockHintFeature, UpdateBannerFeature } from '@/features/settings';
import { SpendingFeature } from '@/features/spending-summary';
import { HomeHighlights } from '@/widgets/home-highlights';
import { HomeNotices } from '@/widgets/home-notices';

const syncStatus = useSyncStatusStore();
/** The «Now» details tile is open: it takes the «What's unusual» / «Recent operations» tile's place too. */
const nowDetails = ref(false);
/** The «Insights» block has something to show: «Spending» shares its row with it. */
const { visible: insightsShown } = useHomeInsights();
</script>

<template>
  <main class="flex flex-col gap-4">
    <!-- «General»: the blocks only; the filters and the side menu are the default layout's (app/layouts). The history
         download is in settings, «Connections»: HomeNotices links there while there is no data. -->
    <HomeNotices />
    <AppLockHintFeature />
    <UpdateBannerFeature />
    <!-- The tile grid (spec desktop-home-tiles): one column, two from 47rem, twelve from 79rem of its own width (the folded
         stack, 466 px, fits 5 of them from there; rows 5·4·3, the «Budget» row, 4·4·4, 12 or 7·5 with «Insights»). The first row's three tiles take a row each
         under 65rem and «Balance» | «Month» over «Month pace» from 65rem to 79rem (BalancesFeature). Features
         render their tiles straight into it (`contents` roots), in this order; each tile says its own span. -->
    <div v-if="syncStatus.hasData" class="@container">
      <div class="grid grid-cols-1 gap-4 @[47rem]:grid-cols-2 @[79rem]:grid-cols-12" data-test="home-grid">
        <BalancesFeature />
        <HomeBudgetFeature />
        <NowStripFeature v-model:details="nowDetails" />
        <HomeHighlights v-if="!nowDetails" />
        <SpendingFeature :beside="insightsShown" />
        <HomeInsightsFeature />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useSyncStatusStore } from '@/entities/sync-status';
import { BalancesFeature } from '@/features/balances';
import { ImportFeature } from '@/features/import-statement';
import { AppLockHintFeature, UpdateBannerFeature } from '@/features/settings';
import { SpendingFeature } from '@/features/spending-summary';
import { SideNav } from '@/shared/layout';
import { GlobalFilters } from '@/widgets/global-filters';
import { HomeNotices } from '@/widgets/home-notices';
import { HOME_NAV } from './constants.ts';

const syncStatus = useSyncStatusStore();
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- The filters stay put above the home screen's own scroll area (App's one never scrolls here). One root element:
         a comment or a second node above it is a second root in dev, and App's out-in <Transition> never leaves. -->
    <!-- The filters are as wide as the grid under them: the same side padding and max width (menu + gap + blocks). -->
    <div class="shrink-0 px-4 min-[45rem]:px-8">
      <GlobalFilters class="mx-auto max-w-[calc(13rem+3rem+52rem)]" />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-4 min-[45rem]:px-8">
      <!-- The grid of the settings screen: the menu on the left, the blocks on the right. -->
      <main
        class="mx-auto grid max-w-[calc(13rem+3rem+52rem)] items-start gap-y-4 pt-6 pb-6 min-[45rem]:grid-cols-[13rem_minmax(0,1fr)] min-[45rem]:gap-x-12"
      >
        <SideNav :groups="HOME_NAV" current="general" label="home.nav.label" />
        <div class="flex min-w-0 flex-col gap-4">
          <HomeNotices />
          <AppLockHintFeature />
          <UpdateBannerFeature />
          <template v-if="syncStatus.hasData">
            <BalancesFeature />
            <SpendingFeature />
          </template>
          <ImportFeature />
        </div>
      </main>
    </div>
  </div>
</template>

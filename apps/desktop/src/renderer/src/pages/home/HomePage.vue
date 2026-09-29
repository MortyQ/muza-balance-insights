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
  <main
    class="mx-auto grid max-w-[calc(13rem+3rem+56rem)] items-start gap-y-4 px-4 pt-1 pb-6 [--side-nav-top:calc(var(--control-h-md)+1rem+1px+1rem)] min-[45rem]:grid-cols-[13rem_minmax(0,1fr)] min-[45rem]:gap-x-12 min-[45rem]:px-8"
  >
    <!-- The grid of the settings screen: the filters across the top, the menu on the left, the blocks on the right.
         --side-nav-top: the menu sticks under the sticky filters (one row: control, py-2, border) plus the row gap.
         No comment above <main>: in dev it is a second root node, and App's out-in <Transition> never leaves. -->
    <GlobalFilters class="col-span-full" />
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
</template>

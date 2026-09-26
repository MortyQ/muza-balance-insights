<script setup lang="ts">
import { useSyncStatusStore } from '@/entities/sync-status';
import { UpdateBannerFeature } from '@/features/app-update';
import { BalancesFeature } from '@/features/balances';
import { ImportFeature } from '@/features/import-statement';
import { ParticipantSwitchFeature } from '@/features/participant-switch';
import { SpendingFeature } from '@/features/spending-summary';
import { AppHeader } from '@/widgets/app-header';
import { HomeNotices } from '@/widgets/home-notices';

const syncStatus = useSyncStatusStore();
</script>

<template>
  <main class="mx-auto flex max-w-4xl flex-col gap-4 px-8 py-6">
    <AppHeader />
    <HomeNotices />
    <UpdateBannerFeature />
    <template v-if="syncStatus.hasData">
      <ParticipantSwitchFeature />
      <SpendingFeature />
      <BalancesFeature />
    </template>
    <ImportFeature />
  </main>
</template>

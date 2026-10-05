<script setup lang="ts">
import { VCard } from '@/shared/ui';

const MONTH_BARS = [40, 55, 35, 60, 45, 70, 50, 65, 40, 55, 75, 60];
</script>

<template>
  <!-- The first load: the screen's cards in their places, so the answer fills them instead of pushing the page down. -->
  <div class="flex flex-col gap-4 motion-safe:animate-pulse" role="status" :aria-label="$t('common.loading')">
    <VCard padding="md">
      <div class="flex flex-col gap-5">
        <div class="flex items-center gap-3">
          <span class="size-10 shrink-0 rounded-xl bg-surface-sunken" />
          <span class="flex flex-col gap-2">
            <span class="h-6 w-40 rounded-md bg-surface-sunken" />
            <span class="h-3.5 w-28 rounded-md bg-surface-sunken" />
          </span>
        </div>
        <div class="flex flex-wrap gap-x-8 gap-y-5">
          <span class="flex min-w-56 flex-1 flex-col gap-2">
            <span class="h-3 w-32 rounded-md bg-surface-sunken" />
            <span class="h-9 w-44 rounded-md bg-surface-sunken" />
          </span>
          <span class="grid flex-[3_1_32rem] grid-cols-2 gap-x-6 gap-y-4 @2xl:grid-cols-3">
            <span v-for="i in 6" :key="i" class="flex flex-col gap-1.5">
              <span class="h-3 w-20 rounded-md bg-surface-sunken" />
              <span class="h-5 w-24 rounded-md bg-surface-sunken" />
            </span>
          </span>
        </div>
      </div>
    </VCard>
    <VCard padding="md">
      <div class="flex flex-col gap-3">
        <span class="h-5 w-48 rounded-md bg-surface-sunken" />
        <span class="flex h-36 items-end gap-1.5">
          <span v-for="(h, i) in MONTH_BARS" :key="i" class="h-(--h) flex-1 rounded-t-md bg-surface-sunken" :style="{ '--h': `${h}%` }" />
        </span>
      </div>
    </VCard>
    <div class="grid gap-4 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <VCard v-for="i in 2" :key="i" padding="md">
        <div class="flex flex-col gap-3">
          <span class="h-5 w-24 rounded-md bg-surface-sunken" />
          <span v-for="j in 4" :key="j" class="h-4 rounded-md bg-surface-sunken" />
        </div>
      </VCard>
    </div>
    <VCard padding="md">
      <div class="flex flex-col gap-3">
        <span class="h-5 w-32 rounded-md bg-surface-sunken" />
        <span v-for="j in 5" :key="j" class="h-10 rounded-md bg-surface-sunken" />
      </div>
    </VCard>
  </div>
</template>

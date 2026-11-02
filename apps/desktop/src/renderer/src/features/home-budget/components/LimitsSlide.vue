<script setup lang="ts">
import { RouterLink } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import { LimitBar, LimitStateChip, PendingNote } from '@/entities/goal';
import { VIcon } from '@/shared/ui';
import type { AttentionLimitView } from '../types.ts';

// The «Limits» slide of home's highlights tile: only the limits in attention or exceeded, with their bars.
const { limits, to } = defineProps<{ limits: ReadonlyArray<AttentionLimitView>; to: RouteLocationRaw }>();
</script>

<template>
  <section class="flex h-full flex-col gap-3" data-test="limits-slide">
    <h3 class="text-sm font-bold">{{ $t('home.budget.limitsTitle') }}</h3>
    <ul class="flex flex-col gap-3">
      <li v-for="l in limits" :key="l.id" class="flex flex-col gap-1.5" data-test="attention-limit">
        <div class="flex items-center gap-2 text-sm">
          <VIcon :icon="l.icon" class="size-4 text-foreground-muted" />
          <span class="min-w-0 flex-1 truncate">{{ l.name }}</span>
          <span class="tabular-nums">{{ l.look.spentOf }}</span>
        </div>
        <LimitBar :fill="l.look.fill" :pace="l.look.pace" :state="l.look.state" />
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <LimitStateChip :state="l.look.state" :text="l.look.stateText" />
          <PendingNote v-if="l.look.pending" :note="l.look.pending" />
        </div>
      </li>
    </ul>
    <RouterLink :to class="mt-auto text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus">{{ $t('home.budget.allLimits') }}</RouterLink>
  </section>
</template>

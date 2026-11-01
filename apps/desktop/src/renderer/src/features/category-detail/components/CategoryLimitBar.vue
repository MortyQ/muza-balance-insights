<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { LimitBar, LimitStateChip } from '@/entities/goal';
import { budgetLink } from '@/shared/config';
import type { CategoryLimitView } from '../composables/useCategoryLimit.ts';

// The category's limit on its screen: spent of the limit with the pace marker and the state, or a quiet «Set a limit»
// with the usual amount. Both lead to the «Budget» screen.
const { view } = defineProps<{ view: CategoryLimitView }>();
</script>

<template>
  <div class="flex flex-col gap-3" data-test="category-limit">
    <div v-for="l in view.limits" :key="l.id" class="flex flex-col gap-1.5">
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span class="font-semibold tabular-nums">{{ $t('category.limit.title', { period: l.period }) }} · {{ l.look.spentOf }}</span>
        <LimitStateChip :state="l.look.state" :text="l.look.stateText" />
      </div>
      <LimitBar :fill="l.look.fill" :pace="l.look.pace" :state="l.look.state" color="var(--cat)" />
      <p class="text-xs text-foreground-muted tabular-nums">
        <template v-if="l.look.paceText">{{ l.look.paceText }} · </template>{{ $t('limits.perDay', { amount: l.look.perDay }) }}
      </p>
    </div>
    <RouterLink :to="budgetLink()" class="self-start text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus" data-test="category-limit-link">
      {{ view.limits.length > 0 ? $t('category.limit.edit') : view.suggestion ? $t('category.limit.setUsual', { amount: view.suggestion }) : $t('category.limit.set') }}
    </RouterLink>
  </div>
</template>

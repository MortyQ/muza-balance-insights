<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { MoneyStack } from '@/entities/currency-display';
import { VChangeChip, VIcon } from '@/shared/ui';
import { SEVERITY_CHIP, SEVERITY_FILL } from '../constants.ts';
import type { FeedRowView } from '../types.ts';
import { hasDetails } from '../utils/feed.ts';
import FeedDetails from './FeedDetails.vue';

// One row of the feed, the same shape for an insight and a signal: icon, title with its one sentence, the amount with
// its «≈» lines. A row with details is a disclosure (a real button); «High» rows start opened, the rest folded. A row
// without details is not a button.
const { row } = defineProps<{ row: FeedRowView }>();

const detailsId = useId();
const expandable = computed(() => hasDetails(row));
const open = ref(row.severity === 'high');
</script>

<template>
  <li data-test="feed-row" :data-kind="row.kind" :data-severity="row.severity">
    <component
      :is="expandable ? 'button' : 'div'"
      :type="expandable ? 'button' : undefined"
      :aria-expanded="expandable ? open : undefined"
      :aria-controls="expandable ? detailsId : undefined"
      class="flex w-full items-center gap-3 px-4 py-3 text-left"
      :class="{ 'transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus': expandable }"
      data-test="feed-row-head"
      @click="expandable && (open = !open)"
    >
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken">
        <VIcon :icon="row.icon" class="size-4 text-foreground-muted" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="flex min-w-0 items-center gap-2">
          <span class="size-2 shrink-0 rounded-full" :class="SEVERITY_FILL[row.severity]" aria-hidden="true" data-test="severity-dot" />
          <span class="min-w-0 truncate text-sm font-semibold">{{ row.title }}</span>
          <span
            data-test="severity"
            :class="row.severity === 'high' ? ['shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_CHIP.high] : 'sr-only'"
          >{{ row.severityLabel }}</span>
        </span>
        <span class="text-xs text-foreground-muted">{{ row.text }}</span>
      </span>
      <MoneyStack class="text-sm font-semibold" :amount="row.amount" :also="row.also" :strong="false">
        <VChangeChip v-if="row.chip" :chip="row.chip" size="sm" />
        <template v-else>{{ row.amount }}</template>
      </MoneyStack>
      <VIcon
        v-if="expandable"
        icon="lucide:chevron-down"
        class="size-4 shrink-0 text-foreground-muted transition-transform motion-reduce:transition-none"
        :class="{ 'rotate-180': open }"
        aria-hidden="true"
      />
    </component>
    <FeedDetails v-if="expandable" v-show="open" :id="detailsId" :row="row" />
  </li>
</template>

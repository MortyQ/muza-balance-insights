<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { MoneyStack } from '@/entities/currency-display';
import { VIcon } from '@/shared/ui';
import type { RecentRowView } from '../types.ts';

// A row opens its operation's category screen; one with an unknown category word is plain.
const { rows } = defineProps<{ rows: ReadonlyArray<RecentRowView> }>();
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <h3 class="text-sm font-bold">{{ $t('home.recent.title') }}</h3>
    <ul class="flex flex-col gap-0.5">
      <li v-for="r in rows" :key="r.key">
        <component
          :is="r.to ? RouterLink : 'div'"
          :to="r.to ?? undefined"
          class="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm"
          :class="{ 'hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': r.to }"
          data-test="recent-row"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken">
            <VIcon :icon="r.icon" class="size-3.5 text-foreground-muted" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{{ r.name }}</span>
            <span class="truncate text-xs text-foreground-muted">
              {{ r.caption }}<template v-if="r.pending"> · <span :title="$t('entities.operations.mark.pendingHint')" data-test="recent-pending">{{ $t('home.recent.pending') }}<span class="sr-only">: {{ $t('entities.operations.mark.pendingHint') }}</span></span></template>
            </span>
          </span>
          <MoneyStack :amount="r.amount" :also="r.also" :strong="false"><span :class="{ 'text-success': r.refund }">{{ r.amount }}</span></MoneyStack>
        </component>
      </li>
    </ul>
  </div>
</template>

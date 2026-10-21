<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { SummaryCardProps } from '../types.ts';

const { title, caption, amount, approx, others, actual, bottom, net, netText, accents, dim } = defineProps<SummaryCardProps>();
defineEmits<{ click: [] }>();
</script>

<template>
  <!-- The total of a view, not a card of a bank: the theme's surface tinted by the first person's colour, no bank mark. -->
  <button
    type="button"
    class="relative flex h-[214px] w-[340px] shrink-0 flex-col justify-between overflow-hidden rounded-[18px] border border-border
           bg-[color-mix(in_oklch,var(--tint)_7%,var(--surface))] p-5 text-left text-foreground shadow-md
           transition-[transform,box-shadow] duration-450 ease-[cubic-bezier(.34,1.8,.64,1)] hover:-translate-y-[3px] hover:shadow-lg
           active:scale-[.97] active:duration-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-border-focus
           motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    :class="{ 'opacity-55': dim }"
    :style="{ '--tint': accents[0] ?? 'var(--surface)' }"
    @click="$emit('click')"
  >
    <span class="flex items-center justify-between gap-3">
      <span class="flex min-w-0 items-center gap-2 text-base font-semibold">
        <span class="grid size-6 shrink-0 place-items-center rounded-[7px] bg-surface-sunken text-foreground-secondary" aria-hidden="true">
          <VIcon icon="lucide:layers" :size="14" />
        </span>
        <span class="truncate">{{ title }}</span>
        <span class="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-foreground-muted">{{ $t('home.balances.total') }}</span>
      </span>
      <span class="flex shrink-0 -space-x-1" aria-hidden="true">
        <span
          v-for="(color, i) in accents"
          :key="i"
          data-test="dot"
          class="size-3 rounded-full bg-(--accent) ring-2 ring-surface"
          :style="{ '--accent': color }"
        />
      </span>
    </span>
    <span class="flex flex-col gap-1">
      <span class="text-sm text-foreground-muted">{{ caption }}</span>
      <span class="text-[30px] leading-none font-bold tracking-tight tabular-nums">{{ amount }}</span>
      <span v-if="approx" class="text-sm text-foreground-muted tabular-nums">{{ approx }}</span>
      <span v-if="others" class="text-sm text-foreground-muted tabular-nums">{{ others }}</span>
      <span v-if="actual" class="text-sm text-foreground-muted tabular-nums">{{ actual }}</span>
    </span>
    <span class="flex items-center justify-between border-t border-border-subtle pt-2.5 text-sm text-foreground-secondary">
      <span>{{ bottom }}</span>
      <span v-if="net !== null" class="inline-flex items-center gap-1 tabular-nums">
        <VIcon :icon="net < 0 ? 'lucide:arrow-down-right' : 'lucide:arrow-up-right'" :color="net < 0 ? 'var(--danger)' : 'var(--success)'" />
        <span class="font-bold text-foreground">{{ netText }}</span>
      </span>
    </span>
  </button>
</template>

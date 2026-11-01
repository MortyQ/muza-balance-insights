<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { VIcon } from '@/shared/ui';
import type { SignalRowView } from '../types.ts';

// A side list (new payees, one-offs): a row opens its category; an empty list says so instead of disappearing.
const { title, hint, rows, empty } = defineProps<{ title: string; hint: string; rows: ReadonlyArray<SignalRowView>; empty: string }>();
</script>

<template>
  <section class="flex flex-col gap-2">
    <div>
      <h2 class="text-sm font-bold">{{ title }}</h2>
      <p class="text-xs text-foreground-muted">{{ hint }}</p>
    </div>
    <ul v-if="rows.length > 0" class="flex flex-col gap-0.5">
      <li v-for="r in rows" :key="r.key">
        <component
          :is="r.to ? RouterLink : 'div'"
          :to="r.to ?? undefined"
          class="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm"
          :class="{ 'hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': r.to }"
          data-test="signal-row"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken">
            <VIcon :icon="r.icon" class="size-3.5 text-foreground-muted" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{{ r.name }}</span>
            <span class="truncate text-xs text-foreground-muted">{{ r.caption }}</span>
          </span>
          <span class="shrink-0 tabular-nums">{{ r.amount }}</span>
        </component>
      </li>
    </ul>
    <p v-else class="text-sm text-foreground-muted" data-test="signal-empty">{{ empty }}</p>
  </section>
</template>

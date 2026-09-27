<script setup lang="ts">
import { computed } from 'vue';
import type { ThemePref } from '@contract/theme.ts';
import { VInfoNotice, VSegmentedControl } from '@/shared/ui';
import { useTheme } from './composables/useTheme.ts';
import { THEME_OPTIONS } from './constants.ts';

const { theme, error, select } = useTheme();
const value = computed<ThemePref>({
  get: () => theme.value ?? 'system',
  set: (t) => void select(t),
});
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h2 class="text-xl font-semibold">Оформление</h2>
      <p class="max-w-[62ch] text-sm text-foreground-muted">Тема окна, меню и системных диалогов.</p>
    </div>
    <div class="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
      <div class="flex min-h-13 flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-semibold">Тема</span>
          <span class="text-sm text-foreground-muted">«Как в системе» меняется вместе с настройкой системы.</span>
        </div>
        <VSegmentedControl v-model="value" :options="THEME_OPTIONS" :disabled="theme === null" />
      </div>
    </div>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </section>
</template>

<script setup lang="ts">
import { VIcon } from '@/shared/ui';
</script>

<template>
  <main class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
    <!-- A placeholder until the analytics blocks exist; the filters and the menu are the default layout's. -->
    <VIcon icon="lucide:chart-column" :size="32" class="text-foreground-muted" />
    <h2 class="text-lg font-semibold">{{ $t('analytics.placeholder.title') }}</h2>
    <p class="max-w-md text-sm text-foreground-secondary">{{ $t('analytics.placeholder.text') }}</p>
  </main>
</template>

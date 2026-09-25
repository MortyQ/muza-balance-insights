<script setup lang="ts">
import { COPYRIGHT, DISCLAIMER, REPO } from '@contract/about.ts';
import { VCard } from '@/shared/ui';
</script>

<template>
  <VCard title="О программе" padding="md">
    <div class="flex flex-col gap-1 text-sm text-foreground-secondary">
      <p>{{ DISCLAIMER }}</p>
      <p class="text-foreground-muted">{{ COPYRIGHT }} · {{ REPO }}</p>
    </div>
  </VCard>
</template>

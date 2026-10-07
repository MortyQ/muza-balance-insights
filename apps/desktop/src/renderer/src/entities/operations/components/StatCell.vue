<script setup lang="ts">
import type { StatView } from '../types.ts';

const { stat } = defineProps<{ stat: StatView }>();
</script>

<template>
  <div class="flex min-w-0 flex-col gap-0.5">
    <dt class="text-xs text-foreground-muted">{{ stat.label }}</dt>
    <dd class="text-xl font-bold tabular-nums" :class="{ 'text-success': stat.tone === 'good' }">{{ stat.value }}</dd>
    <dd v-if="stat.note" class="truncate text-xs text-foreground-muted" :title="stat.note">{{ stat.note }}</dd>
  </div>
</template>

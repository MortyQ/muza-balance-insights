<script setup lang="ts">
import { VAvatar } from '@/shared/ui';
import type { MemberCardView } from '../../types.ts';

const { card } = defineProps<{ card: MemberCardView }>();
</script>

<template>
  <div class="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-raised p-2.5">
    <VAvatar :name="card.name" :color="card.color" size="lg" :custom-size="28" aria-hidden="true" />
    <span class="flex min-w-0 flex-col gap-0.5">
      <span class="font-semibold">{{ card.share }}</span>
      <span class="whitespace-nowrap text-xs text-foreground-muted">{{ card.family }}</span>
    </span>
  </div>
</template>

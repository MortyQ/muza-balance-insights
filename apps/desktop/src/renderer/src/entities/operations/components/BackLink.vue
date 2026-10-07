<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ROUTE } from '@/shared/config';
import { VIcon } from '@/shared/ui';

const { label } = defineProps<{ label: string }>();
</script>

<template>
  <RouterLink
    :to="{ name: ROUTE.home }"
    class="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-border-subtle bg-surface px-3 font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
  >
    <VIcon icon="lucide:chevron-left" class="size-4" />
    {{ label }}
  </RouterLink>
</template>

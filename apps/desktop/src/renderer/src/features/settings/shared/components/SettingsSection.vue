<script setup lang="ts">
import { VIcon } from '@/shared/ui';

const { title, description, note, noteIcon = 'lucide:info' } = defineProps<{
  title: string;
  description?: string;
  /** A closing remark under the section, with an icon. */
  note?: string;
  noteIcon?: string;
}>();
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h2 class="text-xl font-semibold">{{ title }}</h2>
      <p v-if="description" class="max-w-[62ch] text-sm text-foreground-muted">{{ description }}</p>
    </div>
    <slot />
    <p v-if="note" class="flex max-w-[62ch] items-start gap-2 text-sm text-foreground-muted">
      <VIcon :icon="noteIcon" :size="14" class="mt-px shrink-0" />
      {{ note }}
    </p>
  </section>
</template>

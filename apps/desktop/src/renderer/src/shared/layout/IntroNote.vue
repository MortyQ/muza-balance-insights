<script setup lang="ts">
import { VButton, VIcon } from '@/shared/ui';

const { title } = defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <section class="flex items-start gap-3 rounded-2xl bg-primary-subtle/60 px-4 py-3" :aria-label="title" data-test="intro-note">
    <VIcon icon="lucide:lightbulb" class="mt-0.5 size-4 shrink-0 text-primary" />
    <div class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
      <p class="font-semibold">{{ title }}</p>
      <div class="flex flex-col gap-1 text-foreground-secondary"><slot /></div>
    </div>
    <VButton variant="link" size="sm" :text="$t('common.gotIt')" data-test="intro-close" @click="emit('close')" />
  </section>
</template>

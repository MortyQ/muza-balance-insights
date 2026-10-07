<script setup lang="ts">
import type { ShareItemView } from '../types.ts';
import ShareItem from './ShareItem.vue';

const { items, more, title } = defineProps<{ items: ReadonlyArray<ShareItemView>; more: string; title: string }>();
const emit = defineEmits<{ pick: [key: string] }>();
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-base font-bold">{{ title }}</h2>
      <span class="text-xs text-foreground-muted">{{ $t('entities.operations.filterHint') }}</span>
    </div>
    <ShareItem v-for="m in items" :key="m.key" :item="m" @pick="emit('pick', $event)" />
    <p v-if="more" class="px-3 text-xs text-foreground-muted">{{ more }}</p>
  </section>
</template>

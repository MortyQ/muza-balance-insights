<script setup lang="ts">
import type { RegularHeaderView } from '../types.ts';

const { header } = defineProps<{ header: RegularHeaderView }>();
</script>

<template>
  <section class="flex flex-col gap-1">
    <h2 class="text-base font-bold">{{ header.title }}</h2>
    <p v-if="header.also" class="text-xs text-foreground-muted tabular-nums" data-test="money-also">{{ header.also }}</p>
    <p v-if="header.covered" class="text-sm text-foreground-secondary">{{ header.covered }}</p>
  </section>
</template>

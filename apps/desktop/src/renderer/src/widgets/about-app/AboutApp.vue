<script setup lang="ts">
import { computed } from 'vue';
import { AUTHOR, DISCLAIMER, LICENSE, REPO } from '@contract/about.ts';
import { useAppUpdateStore } from '@/entities/app-update';
import { VIcon } from '@/shared/ui';

const update = useAppUpdateStore();
const version = computed(() => update.view?.currentVersion ?? null);
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-xl font-semibold">О программе</h2>
    <div class="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm [&>*+*]:border-t [&>*+*]:border-border-subtle">
      <div class="flex items-center gap-3 px-4 py-3">
        <span class="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-md" aria-hidden="true">
          <VIcon icon="lucide:wallet" :size="24" />
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-semibold">Balance Insights</span>
          <span class="text-sm text-foreground-muted">
            <template v-if="version">Версия {{ version }} · </template>{{ DISCLAIMER }}
          </span>
        </div>
      </div>
      <div class="flex min-h-13 items-center justify-between gap-4 px-4 py-3">
        <span class="text-foreground-secondary">Лицензия</span><span>{{ LICENSE }}</span>
      </div>
      <div class="flex min-h-13 flex-wrap items-center justify-between gap-4 px-4 py-3">
        <span class="text-foreground-secondary">Исходный код</span><span class="font-mono text-sm">{{ REPO }}</span>
      </div>
      <div class="flex min-h-13 items-center justify-between gap-4 px-4 py-3">
        <span class="text-foreground-secondary">Автор</span><span>{{ AUTHOR }}</span>
      </div>
    </div>
  </section>
</template>

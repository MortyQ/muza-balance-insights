<script setup lang="ts">
import { computed } from 'vue';
import type { StatementProblemCode } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { VIcon } from '@/shared/ui';
import { PROBLEM_TEXT } from '../../shared/constants.ts';

const { index, problem, row } = defineProps<{ index: number; problem: StatementProblemCode; row: number | null }>();

const text = computed(() => t(PROBLEM_TEXT[problem], { row: row ?? 0 }));
</script>

<template>
  <li class="flex items-start gap-3 border-t border-border-subtle py-3 text-foreground-muted first:border-t-0" data-test="upload-unknown">
    <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-sunken"><VIcon icon="lucide:file-x" :size="14" /></span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium">{{ $t('integrations.quick.fileSkipped', { n: index + 1 }) }}</p>
      <p class="text-xs">{{ text }}</p>
    </div>
  </li>
</template>

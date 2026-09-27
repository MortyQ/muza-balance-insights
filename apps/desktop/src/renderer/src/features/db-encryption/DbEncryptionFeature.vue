<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useDbStateStore } from '@/entities/db-state';
import { VCard, VInfoNotice } from '@/shared/ui';
import { SCOPE_NOTE } from './constants.ts';
import { encryptionText } from './utils.ts';

const { view } = storeToRefs(useDbStateStore());
const line = computed(() => encryptionText(view.value));
</script>

<template>
  <VCard v-if="line" title="Шифрование базы" padding="md">
    <div class="flex flex-col gap-3">
      <VInfoNotice :card="false" :icon="line.icon" :tone="line.tone" :subtitle="line.text" />
      <p class="text-sm text-foreground-muted">{{ SCOPE_NOTE }}</p>
    </div>
  </VCard>
</template>

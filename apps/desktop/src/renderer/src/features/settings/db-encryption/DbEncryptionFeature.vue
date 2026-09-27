<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useDbStateStore } from '@/entities/db-state';
import { VIcon } from '@/shared/ui';
import { SCOPE_NOTE } from './constants.ts';
import { encryptionText } from './utils.ts';
import SettingsRow from '../shared/components/SettingsRow.vue';

const { view } = storeToRefs(useDbStateStore());
const line = computed(() => encryptionText(view.value));
</script>

<template>
  <!-- A row of «Хранение и токены»: the settings widget puts it into that section's list. -->
  <SettingsRow v-if="line" title="Шифрование базы">
    <template #hint>
      <span class="flex items-start gap-1.5 text-foreground-secondary">
        <VIcon :icon="line.icon" :size="14" class="mt-px shrink-0" :class="line.tone === 'success' ? 'text-success' : 'text-warning'" />
        {{ line.text }}
      </span>
      <span class="mt-1 block">{{ SCOPE_NOTE }}</span>
    </template>
  </SettingsRow>
</template>

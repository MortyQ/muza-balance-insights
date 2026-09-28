<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useDbStateStore } from '@/entities/db-state';
import { SettingsRow } from '@/shared/layout';
import { VIcon } from '@/shared/ui';
import { encryptionText } from './utils.ts';

const { view } = storeToRefs(useDbStateStore());
const line = computed(() => encryptionText(view.value));
</script>

<template>
  <!-- A row of «Storage and tokens»: the settings widget puts it into that section's list. -->
  <!-- What encryption does and does not cover. Nothing about detecting changes to the file: the cipher cannot. -->
  <SettingsRow v-if="line" :title="$t('settings.dbEncryption.title')">
    <template #hint>
      <span class="flex items-start gap-1.5 text-foreground-secondary">
        <VIcon :icon="line.icon" :size="14" class="mt-px shrink-0" :class="line.tone === 'success' ? 'text-success' : 'text-warning'" />
        {{ line.text }}
      </span>
      <span class="mt-1 block">{{ $t('settings.dbEncryption.scope') }}</span>
    </template>
  </SettingsRow>
</template>

<script setup lang="ts">
import type { UpdateState } from '@contract/update.ts';
import { VButton } from '@/shared/ui';

const { state, importRunning = false } = defineProps<{
  state: Readonly<UpdateState>;
  /** Main refuses to restart during an import: the button is off, the status line next to it says why. */
  importRunning?: boolean;
}>();
const emit = defineEmits<{ download: []; install: [] }>();
</script>

<template>
  <VButton v-if="state.phase === 'available' && state.mode === 'manual'" :text="$t('settings.update.download')" icon="lucide:download" @click="emit('download')" />
  <VButton v-else-if="state.phase === 'ready'" :text="$t('settings.update.restart')" icon="lucide:refresh-cw" :disabled="importRunning" @click="emit('install')" />
</template>

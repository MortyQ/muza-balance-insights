<script setup lang="ts">
import type { UpdateState } from '@contract/update.ts';
import { VButton } from '@/shared/ui';

const { state } = defineProps<{ state: Readonly<UpdateState> }>();
const emit = defineEmits<{ download: []; install: [] }>();
</script>

<template>
  <VButton v-if="state.phase === 'available' && state.mode === 'manual'" text="Скачать" icon="lucide:download" @click="emit('download')" />
  <VButton v-else-if="state.phase === 'ready'" text="Перезапустить и обновить" icon="lucide:refresh-cw" @click="emit('install')" />
</template>

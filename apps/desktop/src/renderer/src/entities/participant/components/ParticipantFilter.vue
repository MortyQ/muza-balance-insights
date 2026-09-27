<script setup lang="ts">
import { computed } from 'vue';
import { VSegmentedControl } from '@/shared/ui';
import { FAMILY } from '../constants.ts';
import { useParticipantStore } from '../store/useParticipantStore.ts';
import { filterOptions } from '../utils.ts';

const participant = useParticipantStore();
const options = computed(() => filterOptions(participant.people));
const value = computed<number>({
  get: () => participant.selectedId ?? FAMILY,
  set: (id) => participant.select(id),
});
</script>

<template>
  <div v-if="participant.multiple" class="flex flex-wrap items-center gap-3">
    <VSegmentedControl v-model="value" :options />
  </div>
</template>

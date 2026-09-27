<script setup lang="ts">
// «Чьи деньги»: the filter of every screen with money on it; the choice lives in this entity's store (selectedId).
import { computed } from 'vue';
import { VSegmentedControl } from '@/shared/ui';
import { FAMILY } from '../constants.ts';
import { useParticipantStore } from '../store/useParticipantStore.ts';

const participant = useParticipantStore();
const options = computed(() => [{ label: 'Вся семья', value: FAMILY }, ...participant.people.map((p) => ({ label: p.label, value: p.id }))]);
const value = computed<number>({
  get: () => participant.selectedId ?? FAMILY,
  set: (id) => participant.select(id),
});
</script>

<template>
  <div v-if="participant.multiple" class="flex flex-wrap items-center gap-3">
    <span class="text-foreground-secondary">Чьи деньги:</span>
    <VSegmentedControl v-model="value" :options />
  </div>
</template>

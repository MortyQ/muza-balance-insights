<script setup lang="ts">
import { computed } from 'vue';
import { FAMILY, useParticipantStore } from '@/entities/participant';
import { VSegmentedControl } from '@/shared/ui';

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

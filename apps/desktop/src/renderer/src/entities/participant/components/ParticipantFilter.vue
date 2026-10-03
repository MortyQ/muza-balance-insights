<script setup lang="ts">
import { computed } from 'vue';
import { VSegmentedControl } from '@/shared/ui';
import { FAMILY } from '../constants.ts';
import { useParticipantStore } from '../store/useParticipantStore.ts';
import { filterOptions } from '../utils.ts';

// `failed`: connections that did not update in the last sync → why, worded by the caller (the error texts belong to
// the import, not to this entity). The tooltip of each person also says when they were last updated.
const { failed = {} } = defineProps<{
  failed?: Readonly<Record<number, string>>
}>();

const participant = useParticipantStore();
const options = computed(() => filterOptions(participant.people, { failed, now: new Date(), labelOf: participant.labelOf }));
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

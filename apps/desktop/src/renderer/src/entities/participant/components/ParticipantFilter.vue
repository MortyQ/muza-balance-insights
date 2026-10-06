<script setup lang="ts">
import { computed, useId } from 'vue';
import { VSegmentedControl, VSelect } from '@/shared/ui';
import { FAMILY } from '../constants.ts';
import { useParticipantStore } from '../store/useParticipantStore.ts';
import type { ParticipantFilterMode } from '../types.ts';
import { filterOptions } from '../utils.ts';

// `failed`: connections that did not update in the last sync → why, worded by the caller (the error texts belong to
// the import, not to this entity). The tooltip of each person also says when they were last updated.
const { mode = 'buttons', failed = {} } = defineProps<{
  mode?: ParticipantFilterMode
  failed?: Readonly<Record<number, string>>
}>();

const participant = useParticipantStore();
const id = useId();
const options = computed(() => filterOptions(participant.people, { failed, now: new Date(), labelOf: participant.labelOf }));
const selectOptions = computed(() => options.value.map(({ label, value }) => ({ label, value })));
const value = computed<number>({
  get: () => participant.selectedId ?? FAMILY,
  set: (id) => participant.select(id),
});
// VSelect's model also allows a string and null; the options are ids only.
const selectValue = computed<string | number | null>({
  get: () => value.value,
  set: (id) => {
    if (typeof id === 'number') value.value = id;
  },
});
</script>

<template>
  <div v-if="participant.multiple" class="flex flex-wrap items-center gap-3">
    <VSegmentedControl v-if="mode === 'buttons'" v-model="value" :options />
    <template v-else>
      <label :for="id" class="sr-only">{{ $t('entities.participant.label') }}</label>
      <VSelect :id v-model="selectValue" :options="selectOptions" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PersonRowView } from '../../types.ts';
import PersonRow from './PersonRow.vue';

const { rows } = defineProps<{ rows: ReadonlyArray<PersonRowView> }>();
const emit = defineEmits<{ pick: [participantId: number | null] }>();
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <PersonRow v-for="r in rows" :key="r.participantId ?? 'family'" :row="r" @pick="emit('pick', $event)" />
  </div>
</template>

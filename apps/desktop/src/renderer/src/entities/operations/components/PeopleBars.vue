<script setup lang="ts">
import { computed } from 'vue';
import { VAvatar } from '@/shared/ui';
import type { PartView, PersonView } from '../types.ts';
import PartBars from './PartBars.vue';

const { people, title } = defineProps<{ people: ReadonlyArray<PersonView>; title: string }>();
const parts = computed<PartView[]>(() => people.map(({ participantId, ...row }) => ({ key: participantId, ...row })));
</script>

<template>
  <PartBars :parts :title>
    <template #mark="{ part }">
      <VAvatar :name="part.name" :color="part.color" size="sm" :custom-size="26" aria-hidden="true" />
    </template>
  </PartBars>
</template>

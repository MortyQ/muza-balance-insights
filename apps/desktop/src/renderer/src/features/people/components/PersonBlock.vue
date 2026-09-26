<script setup lang="ts">
import { ref, useId } from 'vue';
import type { PersonView } from '@contract/api.ts';
import { VButton } from '@/shared/ui';
import ConnectionRow from './ConnectionRow.vue';

const { person, secureStorage } = defineProps<{ person: Readonly<PersonView>; secureStorage: boolean }>();
const emit = defineEmits<{
  rename: [label: string, done: (saved: boolean) => void];
  setToken: [connectionId: number, token: string, remember: boolean, done: (saved: boolean) => void];
  remove: [connectionId: number];
}>();

const renaming = ref(false);
const label = ref('');
const nameId = useId();

function startRename() {
  label.value = person.label;
  renaming.value = true;
}

function saveName() {
  emit('rename', label.value, (saved) => {
    if (saved) renaming.value = false;
  });
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <form v-if="renaming" class="flex flex-wrap items-center gap-2" @submit.prevent="saveName">
        <label :for="nameId" class="sr-only">Имя</label>
        <input
          :id="nameId"
          v-model="label"
          class="h-(--control-h) rounded-md border border-input-border bg-input-bg px-(--control-px) focus:border-border-focus focus:outline-none"
          type="text"
          maxlength="80"
        />
        <VButton type="submit" text="Сохранить" :disabled="label.trim() === ''" />
        <VButton variant="neutral" text="Отмена" @click="renaming = false" />
      </form>
      <template v-else>
        <h3 class="text-base font-semibold">{{ person.label }}</h3>
        <span v-if="person.labelFromBank" class="text-sm text-foreground-muted">имя из банка</span>
        <VButton variant="link" text="Переименовать" @click="startRename" />
      </template>
    </div>
    <ConnectionRow
      v-for="c in person.connections"
      :key="c.id"
      :connection="c"
      :secure-storage
      @set-token="(token, remember, done) => emit('setToken', c.id, token, remember, done)"
      @remove="emit('remove', c.id)"
    />
  </section>
</template>

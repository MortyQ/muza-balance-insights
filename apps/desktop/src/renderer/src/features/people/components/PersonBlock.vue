<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef } from 'vue';
import type { PersonView } from '@contract/api.ts';
import { EXPAND_TRANSITION } from '@/shared/lib';
import { VButton } from '@/shared/ui';
import { connectionsCount } from '../utils.ts';

const { person } = defineProps<{ person: Readonly<PersonView> }>();
const emit = defineEmits<{ rename: [label: string, done: (saved: boolean) => void] }>();

const renaming = ref(false);
const label = ref('');
const nameId = useId();
const input = useTemplateRef<HTMLInputElement>('input');

async function toggleRename() {
  if (renaming.value) {
    renaming.value = false;
    return;
  }
  label.value = person.label;
  renaming.value = true;
  await nextTick();
  input.value?.focus();
  input.value?.select();
}

function saveName() {
  emit('rename', label.value, (saved) => {
    if (saved) renaming.value = false;
  });
}
</script>

<template>
  <div class="flex flex-col px-4 py-3">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-sm font-bold text-primary" aria-hidden="true">
          {{ person.label.slice(0, 1).toUpperCase() }}
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-semibold">{{ person.label }}</span>
          <span class="text-sm text-foreground-muted">
            {{ person.labelFromBank ? 'Имя из банка, обновляется при импорте' : 'Имя введено вручную' }} ·
            {{ connectionsCount(person.connections.length) }}
          </span>
        </div>
      </div>
      <VButton variant="link" :text="renaming ? 'Отмена' : 'Переименовать'" :aria-expanded="renaming" @click="toggleRename" />
    </div>
    <!-- The gap lives inside the expanding box (pt-3), so nothing jumps when it opens or closes. -->
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="renaming" class="grid">
        <div class="-mx-1 min-h-0 overflow-hidden px-1">
          <form class="flex flex-wrap items-center gap-2 pt-3 pb-1" @submit.prevent="saveName">
            <label :for="nameId" class="sr-only">Новое имя</label>
            <input
              :id="nameId"
              ref="input"
              v-model="label"
              class="h-(--control-h) w-56 max-w-full rounded-md border border-input-border bg-input-bg px-(--control-px) focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-primary-subtle)] focus:outline-none"
              type="text"
              maxlength="80"
              @keydown.esc.prevent="renaming = false"
            />
            <VButton type="submit" text="Сохранить" :disabled="label.trim() === ''" />
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue';
import type { ColorKey, PersonView } from '@contract/api.ts';
import { ColorSwatches, colorVar } from '@/entities/participant';
import { EXPAND_TRANSITION } from '@/shared/lib';
import { VButton, VCheckbox, VInput } from '@/shared/ui';
import { connectionsCount } from '../utils.ts';

const { person, takenColors } = defineProps<{
  person: Readonly<PersonView>;
  /** Colours of the other people → who has them. */
  takenColors: ReadonlyMap<ColorKey, string>;
}>();
const emit = defineEmits<{
  rename: [label: string, done: (saved: boolean) => void];
  restoreBankName: [done: (saved: boolean) => void];
  color: [color: ColorKey];
}>();

const panel = ref<'rename' | 'color' | null>(null);
const label = ref('');
const fromBank = ref(false);
const form = useTemplateRef<HTMLFormElement>('form');

async function toggleRename() {
  if (panel.value === 'rename') {
    panel.value = null;
    return;
  }
  label.value = person.label;
  fromBank.value = person.labelFromBank;
  panel.value = 'rename';
  await nextTick();
  const input = form.value?.querySelector('input[type="text"]');
  if (!(input instanceof HTMLInputElement) || fromBank.value) return;
  input.focus();
  input.select();
}

function toggleColor() {
  panel.value = panel.value === 'color' ? null : 'color';
}

function saveName() {
  const done = (saved: boolean) => {
    if (saved) panel.value = null;
  };
  if (fromBank.value) emit('restoreBankName', done);
  else emit('rename', label.value, done);
}

function pick(color: ColorKey | null) {
  if (color !== null && color !== person.color) emit('color', color);
}
</script>

<template>
  <div class="flex flex-col px-4 py-3">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="grid size-8 shrink-0 place-items-center rounded-full bg-(--person) text-sm font-bold text-white"
          :style="{ '--person': colorVar(person.color) }"
          aria-hidden="true"
        >
          {{ person.label.slice(0, 1).toUpperCase() }}
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-semibold">{{ person.label }}</span>
          <span class="text-sm text-foreground-muted">
            {{ person.labelFromBank ? $t('settings.people.nameFromBank') : $t('settings.people.nameManual') }} ·
            {{ connectionsCount(person.connections.length) }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <VButton variant="link" :text="panel === 'color' ? $t('settings.people.done') : $t('settings.people.changeColor')" :aria-expanded="panel === 'color'" @click="toggleColor" />
        <VButton variant="link" :text="panel === 'rename' ? $t('settings.people.cancel') : $t('settings.people.rename')" :aria-expanded="panel === 'rename'" @click="toggleRename" />
      </div>
    </div>
    <!-- The gap lives inside the expanding box (pt-3), so nothing jumps when it opens or closes. -->
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="panel === 'rename'" class="grid">
        <div class="-mx-1 min-h-0 overflow-hidden px-1">
          <form ref="form" class="flex flex-col gap-2 pt-3 pb-1" @submit.prevent="saveName">
            <div class="flex flex-wrap items-center gap-2">
              <VInput
                v-model="label"
                class="w-56 max-w-full"
                :disabled="fromBank"
                maxlength="80"
                :name="$t('settings.people.newName')"
                type="text"
                @keydown.esc.prevent="panel = null"
              />
              <VButton type="submit" :text="$t('settings.people.save')" :disabled="!fromBank && label.trim() === ''" />
            </div>
            <VCheckbox v-model="fromBank" :label="$t('settings.people.useBankName')" />
          </form>
        </div>
      </div>
    </Transition>
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="panel === 'color'" class="grid">
        <div class="-mx-1 min-h-0 overflow-hidden px-1">
          <div class="pt-3 pb-1">
            <ColorSwatches :model-value="person.color" :label="$t('settings.people.colorLabel')" :taken="takenColors" @update:model-value="pick" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

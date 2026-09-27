<script setup lang="ts">
import { computed } from 'vue';
import { COLOR_KEYS, type ColorKey } from '@contract/colors.ts';
import { VIcon } from '@/shared/ui';
import { COLOR_NAMES } from '../constants.ts';
import { colorVar } from '../utils.ts';

// No colour picker in muzakit: a radio group of swatches. Taken colours stay visible but cannot be chosen.
const { label, taken } = defineProps<{
  /** The group's accessible name, e.g. «Цвет человека». */
  label: string;
  /** Colour → who has it. */
  taken: ReadonlyMap<ColorKey, string>;
}>();
const model = defineModel<ColorKey | null>({ required: true });

const free = computed(() => COLOR_KEYS.filter((k) => !taken.has(k)));
// Roving tabindex: Tab lands on the chosen swatch (or the first free one), arrows move between the free ones.
const tabStop = computed(() => (model.value !== null && free.value.includes(model.value) ? model.value : free.value[0]));

function title(key: ColorKey): string {
  const who = taken.get(key);
  return who === undefined ? COLOR_NAMES[key] : `${COLOR_NAMES[key]} — занят: ${who}`;
}

function onKey(event: KeyboardEvent) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (step === undefined || free.value.length === 0) return;
  event.preventDefault();
  const at = tabStop.value === undefined ? -1 : free.value.indexOf(tabStop.value);
  const next = free.value[(at + step + free.value.length) % free.value.length];
  if (next === undefined) return;
  model.value = next;
  const group = event.currentTarget;
  if (group instanceof HTMLElement) group.querySelector<HTMLButtonElement>(`[data-color="${next}"]`)?.focus();
}
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="flex flex-wrap gap-2" @keydown="onKey">
    <button
      v-for="key in COLOR_KEYS"
      :key
      type="button"
      role="radio"
      :data-color="key"
      :aria-checked="model === key"
      :aria-label="title(key)"
      :title="title(key)"
      :disabled="taken.has(key)"
      :tabindex="key === tabStop ? 0 : -1"
      :style="{ '--swatch': colorVar(key) }"
      class="grid size-7 cursor-pointer place-items-center rounded-full bg-(--swatch) text-white ring-offset-2 ring-offset-surface transition-[box-shadow,opacity] outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-25"
      :class="model === key ? 'ring-2 ring-foreground' : ''"
      @click="model = key"
    >
      <VIcon v-if="model === key" icon="lucide:check" :size="14" />
    </button>
  </div>
</template>

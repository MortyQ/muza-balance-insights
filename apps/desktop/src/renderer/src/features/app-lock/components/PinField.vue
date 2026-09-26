<script setup lang="ts">
import { onMounted, useId, useTemplateRef, watch } from 'vue';
import { normalizePin } from '../utils.ts';

const { label, autofocus = false, disabled = false } = defineProps<{ label: string; autofocus?: boolean; disabled?: boolean }>();
const pin = defineModel<string>({ required: true, set: normalizePin });

const id = useId();
const input = useTemplateRef<HTMLInputElement>('input');

onMounted(() => {
  if (autofocus) input.value?.focus();
});

// A check or a pause disables the field; once it re-enables, the PIN box should have focus again, not the button.
watch(
  () => disabled,
  (d) => {
    if (!d && autofocus) input.value?.focus();
  },
  { flush: 'post' },
);
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="id" class="text-sm text-foreground-secondary">{{ label }}</label>
    <input
      :id
      ref="input"
      v-model="pin"
      class="h-(--control-h-lg) w-44 rounded-md border border-input-border bg-input-bg px-(--control-px) text-lg tracking-widest focus:border-border-focus focus:outline-none"
      type="password"
      inputmode="numeric"
      autocomplete="off"
      :disabled
    />
  </div>
</template>

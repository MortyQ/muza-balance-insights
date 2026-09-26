<script setup lang="ts">
import { onMounted, useId, useTemplateRef } from 'vue';
import { PIN_MAX } from '@contract/lock.ts';

const { label, autofocus = false, disabled = false } = defineProps<{ label: string; autofocus?: boolean; disabled?: boolean }>();
const pin = defineModel<string>({ required: true, set: (v) => v.replace(/\D/g, '').slice(0, PIN_MAX) });

const id = useId();
const input = useTemplateRef<HTMLInputElement>('input');

onMounted(() => {
  if (autofocus) input.value?.focus();
});
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
      :maxlength="PIN_MAX"
      :disabled
    />
  </div>
</template>

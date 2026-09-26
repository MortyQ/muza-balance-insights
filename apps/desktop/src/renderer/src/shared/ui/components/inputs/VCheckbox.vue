<!-- copied from muzakit/libs/ui/src (2026-09-26); changes: ui/README.md -->
<script lang="ts" setup>
import { computed, useId, useTemplateRef, watchEffect } from "vue";

defineOptions({ inheritAttrs: false });

const {
  id = undefined,
  label = "",
  value = undefined,
  disabled = false,
  indeterminate = false,
} = defineProps<{
  id?: string
  label?: string
  value?: CheckboxValue
  disabled?: boolean
  indeterminate?: boolean
}>();
export type CheckboxValue = string | number | boolean;
export type CheckboxModelValue = boolean | CheckboxValue[];

const modelValue = defineModel<CheckboxModelValue>();

const generatedId = useId();
const uniqueId = computed(() => id || generatedId);

const inputRef = useTemplateRef<HTMLInputElement>("inputRef");

watchEffect(() => {
  if (inputRef.value) {
    inputRef.value.indeterminate = !!indeterminate;
  }
});
</script>

<template>
  <div class="v-checkbox">
    <input
      :id="uniqueId"
      ref="inputRef"
      v-model="modelValue"
      :disabled="disabled"
      :value="value"
      class="v-checkbox__input"
      type="checkbox"
      v-bind="$attrs"
    >
    <label
      v-if="label || $slots.label"
      :class="[
        'v-checkbox__label',
        { 'v-checkbox__label--disabled': disabled }
      ]"
      :for="!disabled ? uniqueId : undefined"
    >
      <slot name="label">
        {{ label }}
      </slot>
    </label>
  </div>
</template>

<style scoped>
@import "../../styles/components/inputs/vcheckbox.scss";
</style>

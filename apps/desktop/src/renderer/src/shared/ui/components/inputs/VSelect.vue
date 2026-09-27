<!-- built on reka-ui (2026-09-26), after muzakit VSelect's public API for a single, non-searchable select:
     `options` / `placeholder` / `disabled` / `label` props and v-model. muzakit's VSelect wraps vue-multiselect,
     which injects a stylesheet (`<style src="vue-multiselect/dist/vue-multiselect.css">`) — banned by the prod CSP
     (`style-src` falls back to `default-src 'self'`, no `unsafe-inline`). Not copied: multi-select, search/tagging,
     floating-label and the custom fixed-position teleport are dropped; reka-ui's SelectPortal + SelectContent
     (`position="popper"`) replace the manual floating logic. See shared/ui/README.md. -->
<script setup lang="ts">
import { computed, useId } from "vue";
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";

import VIcon from "../base/VIcon.vue";

export interface VSelectOption {
  label: string;
  value: string | number;
}

const {
  id = undefined,
  options,
  placeholder = "Select option",
  disabled = false,
  label = "",
} = defineProps<{
  id?: string;
  options: ReadonlyArray<VSelectOption>;
  placeholder?: string;
  disabled?: boolean;
  /** Visible label above the field; also the select's accessible name. */
  label?: string;
}>();

const modelValue = defineModel<string | number | null>({ default: null });

const generatedId = useId();
const uniqueId = computed(() => id || generatedId);

// SelectRoot has no "empty" model value of its own — an unset selection is `undefined` to it, not `null`.
const rootValue = computed<string | number | undefined>({
  get: () => modelValue.value ?? undefined,
  set: (value) => {
    modelValue.value = value ?? null;
  },
});
</script>

<template>
  <div class="v-select" :class="{ 'v-select--disabled': disabled }">
    <label v-if="label" :for="uniqueId" class="v-select__label">{{ label }}</label>

    <SelectRoot v-model="rootValue" :disabled="disabled">
      <SelectTrigger :id="uniqueId" class="v-select__trigger">
        <SelectValue class="v-select__value" :placeholder="placeholder" />
        <SelectIcon class="v-select__caret">
          <VIcon icon="lucide:chevron-down" class="v-select__caret-icon" />
        </SelectIcon>
      </SelectTrigger>

      <SelectPortal>
        <!-- as-child: the panel is our own <div>, so it carries this component's scope attribute (see vselect.scss). -->
        <SelectContent as-child position="popper" :side-offset="4">
          <div class="v-select__content">
            <SelectScrollUpButton class="v-select__scroll-button">
              <VIcon icon="lucide:chevron-up" class="v-select__scroll-icon" />
            </SelectScrollUpButton>

            <SelectViewport class="v-select__viewport">
              <SelectItem v-for="option in options" :key="option.value" :value="option.value" class="v-select__item">
                <SelectItemText>{{ option.label }}</SelectItemText>
                <SelectItemIndicator class="v-select__item-indicator">
                  <VIcon icon="lucide:check" class="v-select__check-icon" />
                </SelectItemIndicator>
              </SelectItem>
            </SelectViewport>

            <SelectScrollDownButton class="v-select__scroll-button">
              <VIcon icon="lucide:chevron-down" class="v-select__scroll-icon" />
            </SelectScrollDownButton>
          </div>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vselect.scss";
</style>

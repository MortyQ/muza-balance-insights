<!-- ours, not copied from muzakit (2026-10-28); see ui/README.md -->
<script generic="T extends string | number" lang="ts" setup>
import VTooltip from "../overlay/VTooltip.vue";

/**
 * Several values on at once — the multi-value sibling of `VSegmentedControl`, in the same track. Each cell is a
 * toggle button (`aria-pressed`) inside a named group; there is no sliding pill, since more than one cell can be on.
 * `required` keeps the last value on: pressing it does nothing, and its tooltip and screen-reader text say why.
 */
export interface ToggleOption<V extends string | number = string | number> {
  label: string
  value: V
  /** Shown on hover. */
  tooltip?: string
}

const model = defineModel<ReadonlyArray<T>>({ required: true });

const {
  options,
  groupLabel,
  required = false,
  lockedHint = "",
} = defineProps<{
  options: ReadonlyArray<ToggleOption<T>>
  /** The group's accessible name: a group without one tells a screen reader nothing. */
  groupLabel: string
  required?: boolean
  /** Why the last value cannot turn off (with `required`). */
  lockedHint?: string
}>();

defineSlots<{
  /** The cell's content; the option's label by default. */
  label?: (props: { option: ToggleOption<T>; on: boolean }) => unknown
}>();

const isOn = (v: T): boolean => model.value.includes(v);
const isLocked = (v: T): boolean => required && isOn(v) && model.value.length === 1;
const tooltipOf = (o: ToggleOption<T>): string => (isLocked(o.value) && lockedHint ? lockedHint : (o.tooltip ?? ""));

function toggle(v: T): void {
  if (isLocked(v)) return;
  // In the options' order, whatever order the cells were pressed in.
  model.value = options.map(o => o.value).filter(x => (x === v ? !isOn(v) : isOn(x)));
}
</script>

<template>
  <div
    :aria-label="groupLabel"
    class="v-toggle-group"
    role="group"
  >
    <VTooltip
      v-for="option in options"
      :key="String(option.value)"
      :disabled="!tooltipOf(option)"
      :text="tooltipOf(option)"
      placement="top"
    >
      <button
        :aria-disabled="isLocked(option.value) || undefined"
        :aria-pressed="isOn(option.value)"
        :class="{ 'v-tg__item--on': isOn(option.value), 'v-tg__item--locked': isLocked(option.value) }"
        class="v-tg__item"
        type="button"
        @click="toggle(option.value)"
      >
        <slot
          :on="isOn(option.value)"
          :option="option"
          name="label"
        >
          {{ option.label }}
        </slot>
        <span
          v-if="isLocked(option.value) && lockedHint"
          class="v-tg__sr-only"
        >{{ lockedHint }}</span>
      </button>
    </VTooltip>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vtogglegroup.scss";
</style>

<!-- built on reka-ui (2026-09-27): MonthPicker in a Popover. Ours, not copied: muzakit has no month picker.
     The value is "YYYY-MM"; CalendarDate stays inside (calendarMonth.ts). Month names come from the dictionaries.
     grid.rows is a 3x4 grid (reka-ui chunks the year's 12 months by 4 per row, not 3 — verified against
     dist/date/calendar.js's createMonthGrid), so the row is styled as a 4-column flex row, not a 3-column one. -->
<script setup lang="ts">
import { computed, ref } from "vue";
import {
  MonthPickerCell, MonthPickerCellTrigger, MonthPickerGrid, MonthPickerGridBody, MonthPickerGridRow, MonthPickerHeader,
  MonthPickerHeading, MonthPickerNext, MonthPickerPrev, MonthPickerRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
} from "reka-ui";
import { monthName, monthShortName, t } from "@/shared/lib";
import { calendarToMonth, monthToCalendar } from "./calendarMonth";
import VIcon from "../base/VIcon.vue";

const { min = undefined, max = undefined, label = undefined, currentYear = undefined } = defineProps<{
  min?: string;
  max?: string;
  label?: string;
  /** The year shown without a suffix on the trigger (default: max's year). */
  currentYear?: number;
}>();
const month = defineModel<string>({ required: true });
const open = ref(false);

const labelText = computed(() => label ?? t("common.monthPicker.label"));

const minCalendar = computed(() => monthToCalendar(min));
const maxCalendar = computed(() => monthToCalendar(max));

const calendarValue = computed({
  get: () => monthToCalendar(month.value),
  set: (v) => {
    const ym = calendarToMonth(v ?? null);
    if (ym) month.value = ym;
    open.value = false;
  },
});
const triggerText = computed(() => {
  const d = monthToCalendar(month.value);
  if (!d) return labelText.value;
  const year = currentYear ?? maxCalendar.value?.year;
  return `${monthName(d.month)}${d.year === year ? "" : ` ${d.year}`}`;
});
const triggerAriaLabel = computed(() => (monthToCalendar(month.value) ? `${labelText.value}: ${triggerText.value}` : labelText.value));
function toMax() {
  if (max) month.value = max;
  open.value = false;
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-month-picker__trigger" :aria-label="triggerAriaLabel">
      <VIcon icon="lucide:calendar" class="v-month-picker__icon" />
      <span>{{ triggerText }}</span>
      <VIcon icon="lucide:chevron-down" class="v-month-picker__caret-icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <!-- as-child: the panel is our own <div>, so it carries this component's scope attribute (see vmonthpicker.scss). -->
      <PopoverContent as-child align="end" :side-offset="6">
        <div class="v-month-picker__content">
          <MonthPickerRoot
            v-slot="{ grid }"
            v-model="calendarValue"
            :min-value="minCalendar"
            :max-value="maxCalendar"
            locale="ru-RU"
            :calendar-label="labelText"
            prevent-deselect
          >
            <MonthPickerHeader class="v-month-picker__header">
              <MonthPickerPrev class="v-month-picker__nav" :aria-label="$t('common.monthPicker.prevYear')"><VIcon icon="lucide:chevron-left" /></MonthPickerPrev>
              <MonthPickerHeading class="v-month-picker__heading" />
              <MonthPickerNext class="v-month-picker__nav" :aria-label="$t('common.monthPicker.nextYear')"><VIcon icon="lucide:chevron-right" /></MonthPickerNext>
            </MonthPickerHeader>
            <MonthPickerGrid class="v-month-picker__grid">
              <MonthPickerGridBody>
                <MonthPickerGridRow v-for="(row, i) in grid.rows" :key="i" class="v-month-picker__row">
                  <MonthPickerCell v-for="m in row" :key="m.toString()" :date="m" class="v-month-picker__cell-wrap">
                    <MonthPickerCellTrigger :month="m" class="v-month-picker__cell">{{ monthShortName(m.month) }}</MonthPickerCellTrigger>
                  </MonthPickerCell>
                </MonthPickerGridRow>
              </MonthPickerGridBody>
            </MonthPickerGrid>
          </MonthPickerRoot>
          <div v-if="max" class="v-month-picker__footer">
            <button type="button" class="v-month-picker__now" @click="toMax">{{ $t('common.monthPicker.thisMonth') }}</button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vmonthpicker.scss";
</style>

<!-- built on reka-ui (2026-09-27): MonthPicker in a Popover. Ours, not copied: muzakit has no month picker.
     The value is "YYYY-MM"; CalendarDate stays inside (calendarMonth.ts). Month names are ours (Russian UI).
     grid.rows is a 3x4 grid (reka-ui chunks the year's 12 months by 4 per row, not 3 — verified against
     dist/date/calendar.js's createMonthGrid), so the row is styled as a 4-column flex row, not a 3-column one. -->
<script setup lang="ts">
import { computed, ref } from "vue";
import {
  MonthPickerCell, MonthPickerCellTrigger, MonthPickerGrid, MonthPickerGridBody, MonthPickerGridRow, MonthPickerHeader,
  MonthPickerHeading, MonthPickerNext, MonthPickerPrev, MonthPickerRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
} from "reka-ui";
import { calendarToMonth, monthToCalendar } from "./calendarMonth";
import VIcon from "../base/VIcon.vue";

const { min = undefined, max = undefined, label = "Месяц", currentYear = undefined } = defineProps<{
  min?: string;
  max?: string;
  label?: string;
  /** The year shown without a suffix on the trigger (default: max's year). */
  currentYear?: number;
}>();
const month = defineModel<string>({ required: true });
const open = ref(false);

const NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

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
  if (!d) return label;
  const year = currentYear ?? maxCalendar.value?.year;
  return `${NAMES[d.month - 1]}${d.year === year ? "" : ` ${d.year}`}`;
});
const triggerAriaLabel = computed(() => (monthToCalendar(month.value) ? `${label}: ${triggerText.value}` : label));
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
      <VIcon icon="lucide:chevron-down" class="v-month-picker__icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="v-month-picker__content" align="end" :side-offset="6">
        <MonthPickerRoot
          v-slot="{ grid }"
          v-model="calendarValue"
          :min-value="minCalendar"
          :max-value="maxCalendar"
          locale="ru-RU"
          :calendar-label="label"
          prevent-deselect
        >
          <MonthPickerHeader class="v-month-picker__header">
            <MonthPickerPrev class="v-month-picker__nav" aria-label="Предыдущий год"><VIcon icon="lucide:chevron-left" /></MonthPickerPrev>
            <MonthPickerHeading class="v-month-picker__heading" />
            <MonthPickerNext class="v-month-picker__nav" aria-label="Следующий год"><VIcon icon="lucide:chevron-right" /></MonthPickerNext>
          </MonthPickerHeader>
          <MonthPickerGrid class="v-month-picker__grid">
            <MonthPickerGridBody>
              <MonthPickerGridRow v-for="(row, i) in grid.rows" :key="i" class="v-month-picker__row">
                <MonthPickerCell v-for="m in row" :key="m.toString()" :date="m" class="v-month-picker__cell-wrap">
                  <MonthPickerCellTrigger :month="m" class="v-month-picker__cell">{{ SHORT[m.month - 1] }}</MonthPickerCellTrigger>
                </MonthPickerCell>
              </MonthPickerGridRow>
            </MonthPickerGridBody>
          </MonthPickerGrid>
        </MonthPickerRoot>
        <div v-if="max" class="v-month-picker__footer">
          <button type="button" class="v-month-picker__now" @click="toMax">Текущий месяц</button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vmonthpicker.scss";
</style>

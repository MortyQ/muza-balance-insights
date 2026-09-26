<!-- built on reka-ui (2026-09-26), after muzakit VDatepicker's public API for date value + trigger + calendar popover.
     muzakit's VDatepicker wraps @vuepic/vue-datepicker (`import "@vuepic/vue-datepicker/dist/main.css"`) — a
     runtime stylesheet import, banned by the prod CSP (`default-src 'self'`, no `style-src 'unsafe-inline'`).
     Not copied: the public value is an ISO "YYYY-MM-DD" string (or, in range mode, `{ start, end }` of those) —
     never `@internationalized/date`'s CalendarDate, which stays an internal detail (see calendarDate.ts). Locale is
     fixed to uk-UA, week starts Monday; no time-of-day, no floating label, no size variants. See shared/ui/README.md. -->
<script setup lang="ts">
import { computed } from "vue";
import type { CalendarDate } from "@internationalized/date";
import {
  DatePickerCalendar,
  DatePickerCellTrigger,
  DatePickerContent,
  DatePickerField,
  DatePickerGrid,
  DatePickerGridBody,
  DatePickerGridHead,
  DatePickerGridRow,
  DatePickerHeadCell,
  DatePickerHeader,
  DatePickerHeading,
  DatePickerInput,
  DatePickerNext,
  DatePickerPrev,
  DatePickerRoot,
  DatePickerTrigger,
  DateRangePickerCalendar,
  DateRangePickerCellTrigger,
  DateRangePickerContent,
  DateRangePickerField,
  DateRangePickerGrid,
  DateRangePickerGridBody,
  DateRangePickerGridHead,
  DateRangePickerGridRow,
  DateRangePickerHeadCell,
  DateRangePickerHeader,
  DateRangePickerHeading,
  DateRangePickerInput,
  DateRangePickerNext,
  DateRangePickerPrev,
  DateRangePickerRoot,
  DateRangePickerTrigger,
} from "reka-ui";

import type { IsoDateRange } from "./calendarDate";
import { calendarDateToIso, calendarRangeToIso, isoRangeToCalendarRange, isoToCalendarDate } from "./calendarDate";
import VIcon from "../base/VIcon.vue";

const {
  id = undefined,
  label = "",
  disabled = false,
  range = false,
} = defineProps<{
  id?: string;
  label?: string;
  disabled?: boolean;
  /** Single date (default) or a `{ start, end }` range. */
  range?: boolean;
}>();

// Single-date value: bound with a plain v-model. Unused (and untouched) in range mode.
const single = defineModel<string | null>({ default: null });
// Range value: bound with v-model:range. Unused (and untouched) in single mode.
const rangeValue = defineModel<IsoDateRange>("range", { default: () => ({ start: null, end: null }) });

const calendarValue = computed<CalendarDate | undefined>({
  get: () => isoToCalendarDate(single.value) ?? undefined,
  set: (value) => {
    single.value = calendarDateToIso(value ?? null);
  },
});

const calendarRange = computed<{ start: CalendarDate | undefined; end: CalendarDate | undefined }>({
  get: () => isoRangeToCalendarRange(rangeValue.value),
  set: (value) => {
    rangeValue.value = calendarRangeToIso(value);
  },
});

const WEEK_STARTS_ON_MONDAY = 1;
</script>

<template>
  <div class="v-datepicker" :class="{ 'v-datepicker--disabled': disabled }">
    <label v-if="label" :for="id" class="v-datepicker__label">{{ label }}</label>

    <DateRangePickerRoot
      v-if="range"
      v-model="calendarRange"
      :id="id"
      class="v-datepicker__root"
      :disabled="disabled"
      locale="uk-UA"
      :week-starts-on="WEEK_STARTS_ON_MONDAY"
    >
      <div class="v-datepicker__field-row">
        <DateRangePickerField v-slot="{ segments }" class="v-datepicker__field">
          <template v-for="item in segments.start" :key="`start-${item.part}`">
            <DateRangePickerInput :part="item.part" type="start" class="v-datepicker__segment">
              {{ item.value }}
            </DateRangePickerInput>
          </template>
          <span class="v-datepicker__range-sep">–</span>
          <template v-for="item in segments.end" :key="`end-${item.part}`">
            <DateRangePickerInput :part="item.part" type="end" class="v-datepicker__segment">
              {{ item.value }}
            </DateRangePickerInput>
          </template>
        </DateRangePickerField>

        <DateRangePickerTrigger class="v-datepicker__trigger" :disabled="disabled">
          <VIcon icon="lucide:calendar" class="v-datepicker__trigger-icon" />
        </DateRangePickerTrigger>
      </div>

      <DateRangePickerContent class="v-datepicker__calendar" :side-offset="4">
        <DateRangePickerCalendar v-slot="{ weekDays, grid }">
          <DateRangePickerHeader class="v-datepicker__calendar-header">
            <DateRangePickerPrev class="v-datepicker__calendar-nav">
              <VIcon icon="lucide:chevron-left" class="v-datepicker__calendar-nav-icon" />
            </DateRangePickerPrev>
            <DateRangePickerHeading class="v-datepicker__calendar-heading" />
            <DateRangePickerNext class="v-datepicker__calendar-nav">
              <VIcon icon="lucide:chevron-right" class="v-datepicker__calendar-nav-icon" />
            </DateRangePickerNext>
          </DateRangePickerHeader>

          <DateRangePickerGrid v-for="month in grid" :key="month.value.toString()" class="v-datepicker__grid">
            <DateRangePickerGridHead>
              <DateRangePickerGridRow class="v-datepicker__grid-row">
                <DateRangePickerHeadCell v-for="day in weekDays" :key="day" class="v-datepicker__head-cell">
                  {{ day }}
                </DateRangePickerHeadCell>
              </DateRangePickerGridRow>
            </DateRangePickerGridHead>
            <DateRangePickerGridBody>
              <DateRangePickerGridRow v-for="(weekDates, index) in month.rows" :key="`week-${index}`" class="v-datepicker__grid-row">
                <DateRangePickerCellTrigger
                  v-for="weekDate in weekDates"
                  :key="weekDate.toString()"
                  :day="weekDate"
                  :month="month.value"
                  class="v-datepicker__cell"
                />
              </DateRangePickerGridRow>
            </DateRangePickerGridBody>
          </DateRangePickerGrid>
        </DateRangePickerCalendar>
      </DateRangePickerContent>
    </DateRangePickerRoot>

    <DatePickerRoot
      v-else
      v-model="calendarValue"
      :id="id"
      class="v-datepicker__root"
      :disabled="disabled"
      locale="uk-UA"
      :week-starts-on="WEEK_STARTS_ON_MONDAY"
    >
      <div class="v-datepicker__field-row">
        <DatePickerField v-slot="{ segments }" class="v-datepicker__field">
          <template v-for="item in segments" :key="item.part">
            <DatePickerInput :part="item.part" class="v-datepicker__segment">
              {{ item.value }}
            </DatePickerInput>
          </template>
        </DatePickerField>

        <DatePickerTrigger class="v-datepicker__trigger" :disabled="disabled">
          <VIcon icon="lucide:calendar" class="v-datepicker__trigger-icon" />
        </DatePickerTrigger>
      </div>

      <DatePickerContent class="v-datepicker__calendar" :side-offset="4">
        <DatePickerCalendar v-slot="{ weekDays, grid }">
          <DatePickerHeader class="v-datepicker__calendar-header">
            <DatePickerPrev class="v-datepicker__calendar-nav">
              <VIcon icon="lucide:chevron-left" class="v-datepicker__calendar-nav-icon" />
            </DatePickerPrev>
            <DatePickerHeading class="v-datepicker__calendar-heading" />
            <DatePickerNext class="v-datepicker__calendar-nav">
              <VIcon icon="lucide:chevron-right" class="v-datepicker__calendar-nav-icon" />
            </DatePickerNext>
          </DatePickerHeader>

          <DatePickerGrid v-for="month in grid" :key="month.value.toString()" class="v-datepicker__grid">
            <DatePickerGridHead>
              <DatePickerGridRow class="v-datepicker__grid-row">
                <DatePickerHeadCell v-for="day in weekDays" :key="day" class="v-datepicker__head-cell">
                  {{ day }}
                </DatePickerHeadCell>
              </DatePickerGridRow>
            </DatePickerGridHead>
            <DatePickerGridBody>
              <DatePickerGridRow v-for="(weekDates, index) in month.rows" :key="`week-${index}`" class="v-datepicker__grid-row">
                <DatePickerCellTrigger
                  v-for="weekDate in weekDates"
                  :key="weekDate.toString()"
                  :day="weekDate"
                  :month="month.value"
                  class="v-datepicker__cell"
                />
              </DatePickerGridRow>
            </DatePickerGridBody>
          </DatePickerGrid>
        </DatePickerCalendar>
      </DatePickerContent>
    </DatePickerRoot>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vdatepicker.scss";
</style>

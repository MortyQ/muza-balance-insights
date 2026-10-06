<!-- Ours, not copied (muzakit has no month range picker). Built on reka-ui MonthPicker / MonthRangePicker in a Popover,
     like VMonthPicker. The value is { from, to } "YYYY-MM" (from === to: one month); the pick is a draft until «Show».
     The caller gives the quick picks of each mode and may add a note under the pick (the `note` slot gets the draft). -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DateRange } from "reka-ui";
import {
  MonthPickerCell, MonthPickerCellTrigger, MonthPickerGrid, MonthPickerGridBody, MonthPickerGridRow, MonthPickerHeader,
  MonthPickerHeading, MonthPickerNext, MonthPickerPrev, MonthPickerRoot,
  MonthRangePickerCell, MonthRangePickerCellTrigger, MonthRangePickerGrid, MonthRangePickerGridBody, MonthRangePickerGridRow,
  MonthRangePickerHeader, MonthRangePickerHeading, MonthRangePickerNext, MonthRangePickerPrev, MonthRangePickerRoot,
  PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
} from "reka-ui";
import { monthName, monthShortName, t } from "@/shared/lib";
import { calendarToMonth, monthToCalendar } from "./calendarMonth";
import VIcon from "../base/VIcon.vue";
import VSegmentedControl from "./VSegmentedControl.vue";

export interface MonthRangePreset {
  id: string;
  label: string;
  /** "YYYY-MM". */
  from: string;
  to: string;
}

type MonthRange = { from: string; to: string };
type Mode = "one" | "range";

const { min, max, presets, label = undefined } = defineProps<{
  min: string;
  max: string;
  presets: { month: MonthRangePreset[]; range: MonthRangePreset[] };
  label?: string;
}>();
const value = defineModel<MonthRange>({ required: true });

const open = ref(false);
const mode = ref<Mode>("range");
const draft = ref<MonthRange>({ ...value.value });
// After the first click of a range only its start is known: the draft is that one month already, but the grid must
// still wait for the end (its value keeps `end` empty, or reka would take the second click as a new start).
const pending = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) return;
  draft.value = { ...value.value };
  pending.value = false;
  mode.value = value.value.from === value.value.to ? "one" : "range";
});
watch(mode, (m) => {
  pending.value = false;
  if (m === "one") draft.value = { from: draft.value.to, to: draft.value.to };
});

const span = (r: MonthRange) =>
  (Number(r.to.slice(0, 4)) - Number(r.from.slice(0, 4))) * 12 + Number(r.to.slice(5, 7)) - Number(r.from.slice(5, 7)) + 1;
const shortText = (ym: string) => `${monthShortName(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
function rangeText(r: MonthRange): string {
  if (r.from === r.to) return `${monthName(Number(r.from.slice(5, 7)))} ${r.from.slice(0, 4)}`;
  return `${shortText(r.from)} – ${shortText(r.to)} · ${t("common.monthRangePicker.months", span(r))}`;
}

const minCalendar = computed(() => monthToCalendar(min));
const maxCalendar = computed(() => monthToCalendar(max));
const one = computed({
  get: () => monthToCalendar(draft.value.from),
  set: (v) => {
    const ym = calendarToMonth(v ?? null);
    if (ym) draft.value = { from: ym, to: ym };
  },
});
const range = computed<DateRange>({
  get: () => ({ start: monthToCalendar(draft.value.from), end: pending.value ? undefined : monthToCalendar(draft.value.to) }),
  set: (v) => {
    const from = calendarToMonth(v.start ?? null);
    if (!from) return;
    const to = calendarToMonth(v.end ?? null);
    pending.value = to === null;
    draft.value = { from, to: to ?? from };
  },
});

const modes = computed(() => [
  { value: "one" as const, label: t("common.monthRangePicker.one") },
  { value: "range" as const, label: t("common.monthRangePicker.range") },
]);
const quick = computed(() => (mode.value === "one" ? presets.month : presets.range));
const isPicked = (p: MonthRangePreset) => p.from === draft.value.from && p.to === draft.value.to;
const triggerLabel = computed(() => `${label ?? t("common.monthRangePicker.label")}: ${rangeText(value.value)}`);

function pick(p: MonthRangePreset): void {
  pending.value = false;
  draft.value = { from: p.from, to: p.to };
}
function apply(): void {
  value.value = { ...draft.value };
  open.value = false;
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-month-range-picker__trigger" :aria-label="triggerLabel">
      <VIcon icon="lucide:calendar-range" class="v-month-range-picker__icon" />
      <span>{{ rangeText(value) }}</span>
      <VIcon icon="lucide:chevron-down" class="v-month-range-picker__caret-icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <!-- as-child: the panel is our own <div>, so it carries this component's scope attribute (see vmonthpicker.scss). -->
      <PopoverContent as-child align="start" :side-offset="6">
        <div class="v-month-range-picker__content">
          <div class="v-month-range-picker__top">
            <VSegmentedControl v-model="mode" :options="modes" size="md" />
            <span class="v-month-range-picker__hint">
              {{ mode === "one" ? $t("common.monthRangePicker.hintOne") : $t("common.monthRangePicker.hintRange") }}
            </span>
          </div>
          <div class="v-month-range-picker__body">
            <div class="v-month-range-picker__quick" role="group" :aria-label="$t('common.monthRangePicker.quick')">
              <button
                v-for="p in quick"
                :key="p.id"
                type="button"
                class="v-month-range-picker__preset"
                :class="{ 'v-month-range-picker__preset--on': isPicked(p) }"
                :aria-pressed="isPicked(p)"
                @click="pick(p)"
              >
                {{ p.label }}
              </button>
            </div>
            <MonthPickerRoot
              v-if="mode === 'one'"
              v-slot="{ grid }"
              v-model="one"
              :min-value="minCalendar"
              :max-value="maxCalendar"
              locale="ru-RU"
              :calendar-label="$t('common.monthRangePicker.one')"
              prevent-deselect
              class="v-month-range-picker__calendar"
            >
              <MonthPickerHeader class="v-month-range-picker__header">
                <MonthPickerPrev class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.prevYear')"><VIcon icon="lucide:chevron-left" /></MonthPickerPrev>
                <MonthPickerHeading class="v-month-range-picker__heading" />
                <MonthPickerNext class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.nextYear')"><VIcon icon="lucide:chevron-right" /></MonthPickerNext>
              </MonthPickerHeader>
              <MonthPickerGrid class="v-month-range-picker__grid">
                <MonthPickerGridBody>
                  <MonthPickerGridRow v-for="(row, i) in grid.rows" :key="i" class="v-month-range-picker__row">
                    <MonthPickerCell v-for="m in row" :key="m.toString()" :date="m" class="v-month-range-picker__cell-wrap">
                      <MonthPickerCellTrigger :month="m" class="v-month-range-picker__cell">{{ monthShortName(m.month) }}</MonthPickerCellTrigger>
                    </MonthPickerCell>
                  </MonthPickerGridRow>
                </MonthPickerGridBody>
              </MonthPickerGrid>
            </MonthPickerRoot>
            <MonthRangePickerRoot
              v-else
              v-slot="{ grid }"
              v-model="range"
              :min-value="minCalendar"
              :max-value="maxCalendar"
              locale="ru-RU"
              :calendar-label="$t('common.monthRangePicker.range')"
              prevent-deselect
              class="v-month-range-picker__calendar"
            >
              <MonthRangePickerHeader class="v-month-range-picker__header">
                <MonthRangePickerPrev class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.prevYear')"><VIcon icon="lucide:chevron-left" /></MonthRangePickerPrev>
                <MonthRangePickerHeading class="v-month-range-picker__heading" />
                <MonthRangePickerNext class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.nextYear')"><VIcon icon="lucide:chevron-right" /></MonthRangePickerNext>
              </MonthRangePickerHeader>
              <MonthRangePickerGrid class="v-month-range-picker__grid">
                <MonthRangePickerGridBody>
                  <MonthRangePickerGridRow v-for="(row, i) in grid.rows" :key="i" class="v-month-range-picker__row">
                    <MonthRangePickerCell v-for="m in row" :key="m.toString()" :date="m" class="v-month-range-picker__cell-wrap">
                      <MonthRangePickerCellTrigger :month="m" class="v-month-range-picker__cell">{{ monthShortName(m.month) }}</MonthRangePickerCellTrigger>
                    </MonthRangePickerCell>
                  </MonthRangePickerGridRow>
                </MonthRangePickerGridBody>
              </MonthRangePickerGrid>
            </MonthRangePickerRoot>
          </div>
          <div class="v-month-range-picker__footer">
            <div class="v-month-range-picker__summary">
              <div class="v-month-range-picker__picked">{{ rangeText(draft) }}</div>
              <slot name="note" :from="draft.from" :to="draft.to" />
            </div>
            <button type="button" class="v-month-range-picker__cancel" @click="open = false">{{ $t("common.monthRangePicker.cancel") }}</button>
            <button type="button" class="v-month-range-picker__apply" @click="apply">{{ $t("common.monthRangePicker.apply") }}</button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vmonthrangepicker.scss";
</style>

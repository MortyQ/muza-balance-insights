<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script generic="T extends string | number" lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";

import VIcon from "../base/VIcon.vue";
import VTooltip from "../overlay/VTooltip.vue";

/**
 * Generic over the value so a caller with a closed set — `"DAY" | "WEEK" |
 * "MONTH"` — gets that type back from `v-model` instead of `string | number`.
 * The default keeps every untyped call site compiling unchanged.
 */
export interface SegmentOption<V extends string | number = string | number> {
  label: string
  value: V
  icon?: string
  disabled?: boolean
  /** Shown on hover. HTML is allowed, as in VTooltip's `allow-html`. */
  tooltip?: string
}

const {
  modelValue,
  options,
  size = undefined,
  fullWidth = false,
  disabled = false,
  loading = false,
} = defineProps<{
  modelValue: T
  options: SegmentOption<T>[]
  /**
   * 28 / 32 / 40px. Left unset the control keeps the chrome's natural 30px,
   * which is what every other control in a toolbar row stands at.
   */
  size?: "sm" | "md" | "lg"
  fullWidth?: boolean
  disabled?: boolean
  /**
   * A selection is being persisted. Blocks input and shows a spinner on the
   * selected option.
   *
   * The label fades in place and the spinner is centred over the segment, so its
   * width never changes and the pill stays put.
   *
   * This assumes the consumer moves `modelValue` on click and rolls it back if
   * the write fails — otherwise the spinner sits on the old option and says
   * nothing about what was clicked.
   */
  loading?: boolean
}>();

const emit = defineEmits<{
  "update:modelValue": [value: T]
}>();

const iconSize = computed(() => (size ? { sm: 14, md: 16, lg: 20 }[size] : 15));

const rootClass = computed(() => ({
  ...(size ? { [`v-segmented-control--${size}`]: true } : {}),
  "v-segmented-control--full-width": fullWidth,
  "v-segmented-control--disabled": disabled,
  "v-segmented-control--loading": loading,
}));

const isPending = (option: SegmentOption<T>): boolean => loading && modelValue === option.value;

const getItemClass = (option: SegmentOption<T>) => ({
  "v-sc__item--active": modelValue === option.value,
  "v-sc__item--disabled": !!option.disabled,
  "v-sc__item--pending": isPending(option),
});

// ── The sliding pill ───────────────────────────────────────────────────────
// One element that travels to the selected segment, rather than each segment
// painting its own active background: a background swap can only cut from one
// segment to the next, never move between them.
const track = useTemplateRef<HTMLDivElement>("track");

const pillX = ref(0);
const pillWidth = ref(0);
const hasSelection = ref(false);
// Off until the pill has been placed once. Without it the first measurement
// would animate too, and the pill would slide in from the track's left edge on
// every page load.
const isPillReady = ref(false);

const pillStyle = computed(() => ({
  "--v-sc-pill-x": `${pillX.value}px`,
  "--v-sc-pill-w": `${pillWidth.value}px`,
}));

const placePill = (): void => {
  const el = track.value;
  if (!el) return;
  const index = options.findIndex(o => o.value === modelValue);
  const button = el.querySelectorAll<HTMLButtonElement>(".v-sc__item")[index];
  hasSelection.value = !!button;
  if (!button) return;

  // Measured against the track rather than through `offsetLeft`: every segment
  // sits inside a VTooltip wrapper, and `offsetLeft` is relative to the nearest
  // positioned ancestor, which is not guaranteed to be the track. The pill is
  // absolutely positioned inside the track's padding box, hence `clientLeft` —
  // the left border — coming off the delta.
  const trackBox = el.getBoundingClientRect();
  const box = button.getBoundingClientRect();
  pillX.value = box.left - trackBox.left - el.clientLeft;
  pillWidth.value = box.width;
};

// `flush: "post"` so the measurement sees the DOM this change produced.
watch(() => [modelValue, options], placePill, { flush: "post", deep: true });

// The pill is measured from the real segments, so anything that changes their
// width without touching the props — `fullWidth` in a resizing container, a
// wrapping parent, a late font swap — has to move it too.
// Native ResizeObserver in place of @vueuse/core's useResizeObserver (the only use of vueuse here).
let resizeObserver: ResizeObserver | null = null;
onBeforeUnmount(() => resizeObserver?.disconnect());

onMounted(async () => {
  if (track.value) {
    resizeObserver = new ResizeObserver(placePill);
    resizeObserver.observe(track.value);
  }
  placePill();
  await nextTick();
  requestAnimationFrame(() => {
    isPillReady.value = true;
  });
});

const handleSelect = (option: SegmentOption<T>) => {
  if (option.disabled || disabled || loading) return;
  emit("update:modelValue", option.value);
};
</script>

<template>
  <div
    ref="track"
    :class="rootClass"
    class="v-segmented-control"
  >
    <span
      :class="{
        'v-sc__pill--visible': hasSelection,
        'v-sc__pill--ready': isPillReady,
      }"
      :style="pillStyle"
      aria-hidden="true"
      class="v-sc__pill"
    />
    <!-- Every segment is wrapped, tooltip or not, so the track's children are
         uniform and the geometry below has one shape to style. VTooltip with
         `disabled` renders its slot and nothing else. -->
    <VTooltip
      v-for="option in options"
      :key="String(option.value)"
      :allow-html="true"
      :disabled="!option.tooltip"
      :text="option.tooltip ?? ''"
      placement="top"
    >
      <button
        :aria-busy="isPending(option) || undefined"
        :aria-pressed="modelValue === option.value"
        :class="getItemClass(option)"
        :disabled="option.disabled || disabled || loading"
        class="v-sc__item"
        type="button"
        @click="handleSelect(option)"
      >
        <!-- The label stays in flow and only fades: pulling it out for the
             spinner would collapse the segment's width and drag the pill with it. -->
        <span class="v-sc__label">
          <VIcon
            v-if="option.icon"
            :icon="option.icon"
            :size="iconSize"
          />
          <span>{{ option.label }}</span>
        </span>

        <span
          v-if="isPending(option)"
          class="v-sc__spinner"
        >
          <VIcon
            :loading="true"
            :size="iconSize"
          />
        </span>
      </button>
    </VTooltip>
  </div>
</template>

<style scoped>
@import "../../styles/components/inputs/vsegmentedcontrol.scss";
</style>

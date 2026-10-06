<!-- Ours, not copied: muzakit has no charts. One ECharts chart on canvas (echarts.ts registers what can be drawn).
     `option` is plain ECharts option; a colour may be a CSS value (`var(--cat)`, `color-mix(…)`): canvas cannot read
     variables, so they are resolved here against this element — and again when the theme changes. The canvas is
     aria-hidden: the consumer says the same in text (an sr-only list). -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { init, type EChartsCoreOption, type EChartsType } from "./echarts.ts";
import { resolveCssColors } from "./resolveCssColors.ts";

const { option } = defineProps<{ option: Readonly<EChartsCoreOption> }>();

const root = useTemplateRef<HTMLDivElement>("root");
const probe = useTemplateRef<HTMLSpanElement>("probe");
let chart: EChartsType | null = null;
let resize: ResizeObserver | null = null;
let theme: MutationObserver | null = null;

// One pixel to turn any CSS colour into rgba: ECharts parses only hex, rgb and hsl — an oklch() fill loses its colour
// when the hover lightens it. No 2D context only under a test DOM; there the computed colour is kept.
const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true });

/** A CSS colour as the browser computes it here (the probe inherits this element's custom properties), as rgba. */
function cssColor(value: string): string {
  const el = probe.value;
  if (!el) return value;
  el.style.color = value;
  const computed = getComputedStyle(el).color || value;
  if (!pixel) return computed;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = computed;
  pixel.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = pixel.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
}

function draw(): void {
  if (!chart || !root.value) return;
  const font = getComputedStyle(root.value);
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  chart.setOption(
    { textStyle: { fontFamily: font.fontFamily, color: font.color }, ...(still ? { animation: false } : {}), ...resolveCssColors(option, cssColor) },
    { notMerge: true },
  );
}

onMounted(() => {
  if (!root.value) return;
  chart = init(root.value, null, { renderer: "canvas" });
  draw();
  resize = new ResizeObserver(() => chart?.resize());
  resize.observe(root.value);
  theme = new MutationObserver(draw);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
});

watch(() => option, draw, { deep: true });

onBeforeUnmount(() => {
  resize?.disconnect();
  theme?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div class="v-chart" aria-hidden="true">
    <div ref="root" class="v-chart__canvas" />
    <span ref="probe" class="v-chart__probe" />
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/charts/vchart.scss";
</style>

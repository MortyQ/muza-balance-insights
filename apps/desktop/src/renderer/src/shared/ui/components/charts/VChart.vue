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

/** A CSS colour as the browser computes it here (the probe inherits this element's custom properties). */
function cssColor(value: string): string {
  const el = probe.value;
  if (!el) return value;
  el.style.color = value;
  return getComputedStyle(el).color || value;
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

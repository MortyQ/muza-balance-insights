<!-- Ours, not copied (2026-11-01): muzakit has no carousel.
     Slides side by side in a native scroller without a scroll bar: swipe, Shift + wheel and a mouse drag, snapping to
     whole slides; a dot per slide under it (only with two or more). `v-model` — the id of the slide in view. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, useTemplateRef, watch } from "vue";
import { useDragScroll } from "@/shared/lib";

export interface CarouselSlide {
  id: string
  /** Names the slide for its dot («Slide 2 of 2: label»). */
  label: string
}

const { slides, dotLabel } = defineProps<{
  slides: ReadonlyArray<CarouselSlide>
  /** A dot's accessible name from the slide's place and label. */
  dotLabel: (n: number, total: number, label: string) => string
}>();
const current = defineModel<string>({ default: "" });

const track = useTemplateRef<HTMLElement>("track");
const dots = useTemplateRef<HTMLElement>("dots");
/** The slide in view: the model when it names a slide, else the first. */
const shown = computed(() => (slides.some((s) => s.id === current.value) ? current.value : (slides[0]?.id ?? "")));
const { dragging } = useDragScroll(track, () => slides.length > 1);

const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function go(id: string): void {
  const el = track.value?.querySelector<HTMLElement>(`[data-slide="${CSS.escape(id)}"]`);
  if (!track.value || !el) return;
  track.value.scrollTo({ left: el.offsetLeft - track.value.offsetLeft, behavior: reduceMotion() ? "auto" : "smooth" });
  current.value = id;
}

function onDotKey(e: KeyboardEvent, i: number): void {
  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  const next = slides[i + step];
  if (!step || !next) return;
  e.preventDefault();
  go(next.id);
  dots.value?.querySelectorAll<HTMLElement>("button")[i + step]?.focus();
}

// The slide most in view is the current one; without IntersectionObserver (tests) the dots alone move it.
let observer: IntersectionObserver | null = null;
watch(
  () => [track.value, slides.length] as const,
  ([el]) => {
    observer?.disconnect();
    observer = null;
    if (!el || typeof IntersectionObserver === "undefined") return;
    observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.find((e) => e.isIntersecting && e.intersectionRatio >= 0.6);
        const id = seen?.target.getAttribute("data-slide");
        if (id) current.value = id;
      },
      { root: el, threshold: 0.6 },
    );
    for (const s of el.querySelectorAll("[data-slide]")) observer.observe(s);
  },
  { flush: "post" },
);
onBeforeUnmount(() => observer?.disconnect());

// A slide that goes away while in view: back to the first, without motion.
watch(
  () => slides.map((s) => s.id).join("\n"),
  () => {
    if (slides.some((s) => s.id === current.value)) return;
    current.value = slides[0]?.id ?? "";
    track.value?.scrollTo({ left: 0, behavior: "auto" });
  },
  { immediate: true, flush: "post" },
);
</script>

<template>
  <div class="v-carousel">
    <div ref="track" class="v-carousel__track" :class="{ 'v-carousel__track--dragging': dragging, 'v-carousel__track--single': slides.length < 2 }">
      <div v-for="s in slides" :key="s.id" class="v-carousel__slide" :data-slide="s.id" :inert="s.id !== shown ? true : undefined">
        <slot :name="s.id" />
      </div>
    </div>
    <div v-if="slides.length > 1" ref="dots" class="v-carousel__dots">
      <button
        v-for="(s, i) in slides"
        :key="s.id"
        type="button"
        class="v-carousel__dot"
        data-test="carousel-dot"
        :aria-label="dotLabel(i + 1, slides.length, s.label)"
        :aria-current="s.id === shown ? 'true' : undefined"
        @click="go(s.id)"
        @keydown="onDotKey($event, i)"
      >
        <span class="v-carousel__dot-mark" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/layout/vcarousel.scss";
</style>

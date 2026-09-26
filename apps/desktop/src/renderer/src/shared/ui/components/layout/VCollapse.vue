<!-- copied from muzakit/libs/ui/src (2026-09-26); no changes -->
<script lang="ts" setup>
/**
 * Minimal animated container: height 0 → auto without a hardcoded pixel height.
 *
 * Unlike `VAccordion` it renders no header, no button and no chevron — the
 * trigger lives in the consuming component. That is the point: an accordion
 * header is a `<button>`, so it cannot host interactive children (status
 * controls, links), and a card header usually has to.
 */
const { duration = 200, unmount = false } = defineProps<{
  /** Transition duration in ms. Keep it under 300 — this is UI, not marketing. */
  duration?: number
  /**
   * Remove the content from the DOM while collapsed. Off by default: keeping it
   * mounted is what makes a lazily-loaded chart inside stay loaded after the
   * first expand.
   */
  unmount?: boolean
}>();

const expanded = defineModel<boolean>({ default: false });
</script>

<template>
  <div
    :class="{ 'v-collapse--expanded': expanded }"
    :style="{ '--v-collapse-duration': `${duration}ms` }"
    class="v-collapse"
  >
    <div class="v-collapse__wrap">
      <div
        v-if="!unmount || expanded"
        :aria-hidden="!expanded"
        class="v-collapse__content"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/layout/vcollapse.scss";
</style>

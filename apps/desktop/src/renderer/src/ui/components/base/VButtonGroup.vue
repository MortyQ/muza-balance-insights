<!-- copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md -->
<script lang="ts" setup>
import { provide } from "vue";

import { BUTTON_GROUP_KEY } from "./injectionKeys";

/**
 * Joins several `VButton`s into one attached track: outer corners rounded, inner
 * corners square, adjacent hairlines overlapped into a single divider.
 *
 * It owns no colour and draws nothing of its own — the cells keep their own
 * variants, so a `warning` cell stays amber inside the track. All this component
 * contributes is the layout and the provided flag that tells each child it is a
 * cell.
 *
 * **This is not a selection control.** It has the silhouette of
 * `VSegmentedControl` and the opposite meaning: every cell is a separate action,
 * nothing is ever "the selected one", and there is deliberately no sliding pill
 * or active state. Reach for `VSegmentedControl` when the question is *which
 * one*, and for this when the answer is *these are three different things to
 * do*.
 *
 * `aria-label` is required and falls through to the root — a `role="group"` with
 * no name tells a screen reader nothing about what it groups.
 *
 * ```vue
 * <VButtonGroup aria-label="Incident links">
 *   <VButton text="Seller Central" variant="neutral" />
 *   <VButton text="Slack" variant="neutral" />
 * </VButtonGroup>
 * ```
 *
 * Two notes on using it, both learned the hard way:
 * - **Omit unavailable cells with `v-if`, never `:disabled`.** A dimmed cell
 *   inside a shared track reads as a rendering failure; a shorter track reads as
 *   a shorter track.
 * - **A track cannot wrap.** It is one atom on a narrow screen, so keep the
 *   labels short — the group already says these belong together, which makes the
 *   verb in "Open in Seller Central" redundant.
 */
provide(BUTTON_GROUP_KEY, true);
</script>

<template>
  <div
    class="v-button-group"
    role="group"
  >
    <slot />
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/base/vbuttongroup.scss";
</style>

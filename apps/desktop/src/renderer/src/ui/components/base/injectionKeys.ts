/* copied from muzakit/libs/ui/src (2026-09-25); changes: ui/README.md */
import type { InjectionKey } from "vue";

/**
 * Provided by `VButtonGroup`, read by `VButton`.
 *
 * The group needs its children to drop their outer radius and overlap their
 * borders, and there are only two ways to arrange that: the parent reaches into
 * the child with `:deep(.v-button)`, or the child is told it is grouped and
 * restyles itself. The second is the one that keeps every pixel of a button
 * inside `VButton.vue` — so the group carries layout and nothing else.
 */
export const BUTTON_GROUP_KEY: InjectionKey<boolean> = Symbol("buttonGroup");

// Class sets for <Transition v-bind="…">. Full class strings, so Tailwind's scanner sees them.

/**
 * Content that slides open below a button. The element must be `grid` with one child `min-h-0 overflow-hidden`:
 * its row animates 0fr → 1fr, so no height is measured in JS. Reduced motion keeps the fade only.
 */
// Softer than the usual UI ease-out, at the user's request (26.09): an even ease-in-out, opacity trailing the height.
export const EXPAND_TRANSITION = {
  enterActiveClass:
    'transition-[grid-template-rows,opacity] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] [transition-delay:0ms,80ms] motion-reduce:transition-opacity',
  enterFromClass: 'grid-rows-[0fr] opacity-0',
  enterToClass: 'grid-rows-[1fr] opacity-100',
  leaveActiveClass:
    'transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-opacity',
  leaveFromClass: 'grid-rows-[1fr] opacity-100',
  leaveToClass: 'grid-rows-[0fr] opacity-0',
} as const;

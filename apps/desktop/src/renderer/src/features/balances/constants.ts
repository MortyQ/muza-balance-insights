/** Row step: card width 340 + gap 16. */
export const CARD_STEP = 356;
/** Cards peeking out from behind the front one. */
export const STACK_DEPTH = 3;
/** Cards the row is sized for: the arrows page until the last two are in view. */
export const VISIBLE_CARDS = 2;
/** Stagger when the row opens (ms per card) and when it folds back (ms per card, from the far end). */
export const OPEN_STAGGER = 45;
export const CLOSE_STAGGER = 20;
/**
 * The folded stack's width (a card and STACK_DEPTH peeking 22 px each), the gap before the month panel and the panel's
 * narrowest width. Side by side from 430 + 260 = 690 px of block width (the `@[44rem]` of BalancesFeature, rounded up);
 * narrower, the panel goes under the stack. The Tailwind classes carry these as literals.
 */
export const STACK_WIDTH = 406;
export const PANEL_GAP = 24;
export const PANEL_MIN = 260;

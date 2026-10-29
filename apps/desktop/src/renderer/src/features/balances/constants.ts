/** A card's width and the gap between cards of the row; the row's step is their sum. */
export const CARD_WIDTH = 400;
export const CARD_GAP = 16;
export const CARD_STEP = CARD_WIDTH + CARD_GAP;
/**
 * Room above the cards inside the row (px): the row scrolls sideways, so it clips vertically too, and a hovered card
 * rises by 3 px with its shadow. The row is pulled up by as much (`-mt-2` in CardStack), so nothing moves on screen.
 */
export const ROW_INSET = 8;
/** Cards peeking out from behind the front one. */
export const STACK_DEPTH = 3;
/** Waiting for the end of a smooth scroll before the row folds, when `scrollend` never comes (ms). */
export const SCROLL_END_WAIT = 500;
/** Mouse movement before a press on the row becomes a drag (px). */
export const DRAG_THRESHOLD = 5;
/** Stagger when the row opens (ms per card) and when it folds back (ms per card, from the far end). */
export const OPEN_STAGGER = 45;
export const CLOSE_STAGGER = 20;
/** The most people the family card names in its shares line; the rest go into «+N». */
export const SHARES_NAMED = 3;
/** Where «Month pace»'s «Together / By banks» choice is remembered on this computer. */
export const PACE_SPLIT_KEY = 'home.pace.split';

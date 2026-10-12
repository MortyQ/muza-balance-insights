/** Row step: card width 340 + gap 16. */
export const CARD_STEP = 356;
/** Cards peeking out from behind the front one. */
export const STACK_DEPTH = 3;
/** Cards in view in the row until its width is measured: the arrows page until the last ones are in view. */
export const VISIBLE_CARDS = 2;
/** Card width; the gap between two cards of the row is CARD_STEP − CARD_WIDTH. */
export const CARD_WIDTH = 340;
/**
 * A sideways swipe (touchpad, shift + wheel) pages the row by one card once it has travelled WHEEL_STEP px; the swipe
 * is over when no wheel event came for WHEEL_QUIET ms (its inertia keeps sending them long after the fingers left).
 */
export const WHEEL_STEP = 60;
export const WHEEL_QUIET = 150;
/**
 * A new swipe made while the last one's inertia still runs: at once when it goes the other way; the same way — no
 * sooner than WHEEL_REST ms after the page, by a push of at least WHEEL_PUSH px over the slowest event since.
 */
export const WHEEL_REST = 250;
export const WHEEL_PUSH = 20;
/** Stagger when the row opens (ms per card) and when it folds back (ms per card, from the far end). */
export const OPEN_STAGGER = 45;
export const CLOSE_STAGGER = 20;

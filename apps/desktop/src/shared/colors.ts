// Colour keys of people: exactly the core's palette (colors.ts COLOR_KEYS; checked in src/main/people.ts).
// The renderer maps each key to its shade per theme (--series-<key> in theme.css).
export const COLOR_KEYS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

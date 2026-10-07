import type { Scope } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** The scope switch; labels are dictionary keys, the feature translates them. */
export const SCOPES: ReadonlyArray<{ label: MessageKey; value: Scope }> = [
  { label: 'home.spending.scope.personal', value: 'personal' },
  { label: 'home.spending.scope.business', value: 'business' },
];

/** Categories named one by one; the rest is one «N more categories» line. */
export const TOP = 7;

/** Category colours by rank in the family's order (theme.css `--category-N`, apart from the people's colours); the rest is grey. */
export const CATEGORY_COLORS: ReadonlyArray<string> = Array.from({ length: TOP }, (_, i) => `var(--category-${i + 1})`);

/** «N more categories». */
export const REST_COLOR = 'var(--border-strong)';

/** A named category ranked below the family's top 7 (shown when a person is picked): muted, apart from the rest-grey. */
export const BELOW_TOP_COLOR = 'var(--category-other)';

/** «What's unusual»: a category off its usual by at least this share and this many kopecks; at most this many lines. */
export const INSIGHT_SHARE = 0.2;
export const INSIGHT_MIN = 50_000;
export const INSIGHT_MAX = 3;
/** A usual under this many kopecks is too small a base for a share: the line says the amount alone. */
export const INSIGHT_BASE = 100_000;

/** localStorage key of the menu choices (a convenience: defaults when storage is unavailable). */
export const PREFS_KEY = 'spending.view';

/** The tone of an operations difference: more — orange, fewer — blue (as the change chips). */
export const OPS_TONE = {
  up: 'text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]',
  down: 'text-[color-mix(in_oklch,var(--series-blue)_72%,var(--foreground))]',
  neutral: 'text-foreground-muted',
} as const;

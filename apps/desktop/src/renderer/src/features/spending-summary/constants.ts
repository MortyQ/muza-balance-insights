import type { CategoryId } from '@contract/categories.ts';
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

export const CATEGORY_ICON: Readonly<Record<CategoryId | 'rest', string>> = {
  groceries: 'lucide:shopping-cart', cafes: 'lucide:coffee', transport: 'lucide:bus', health: 'lucide:heart-pulse',
  beauty: 'lucide:sparkles', clothing: 'lucide:shirt', home: 'lucide:sofa', telecom: 'lucide:smartphone',
  entertainment: 'lucide:clapperboard', travel: 'lucide:plane', sport: 'lucide:dumbbell', pets: 'lucide:paw-print',
  insurance: 'lucide:shield-check', taxes: 'lucide:landmark', cash: 'lucide:banknote', delivery: 'lucide:truck',
  education: 'lucide:graduation-cap', gifts: 'lucide:gift', utilities: 'lucide:zap', marketplaces: 'lucide:package',
  charity: 'lucide:hand-heart', fees: 'lucide:percent', p2p: 'lucide:send', family: 'lucide:users',
  installments: 'lucide:credit-card', ownTransfers: 'lucide:arrow-left-right', income: 'lucide:wallet',
  other: 'lucide:circle-ellipsis', rest: 'lucide:list',
};

/** localStorage key of the menu choices (a convenience: defaults when storage is unavailable). */
export const PREFS_KEY = 'spending.view';

/** The tone of an operations difference: more — orange, fewer — blue (as the change chips). */
export const OPS_TONE = {
  up: 'text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]',
  down: 'text-[color-mix(in_oklch,var(--series-blue)_72%,var(--foreground))]',
  neutral: 'text-foreground-muted',
} as const;

import type { CategoryId } from '@contract/categories.ts';

/** Categories coloured by their rank in this month's spending (theme.css `--category-1…7`); the rest is `--category-other`. */
export const COLORED = 7;

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

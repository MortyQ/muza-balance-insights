// Spending categories as the renderer names them: the keys of the core's CATEGORY (tests/categories.test.ts keeps
// the two lists equal). The core stores and groups by its own word; main adds the id, the renderer words it.

export const CATEGORY_IDS = [
  'groceries', 'cafes', 'transport', 'health', 'beauty', 'clothing', 'home', 'telecom', 'entertainment', 'travel',
  'sport', 'pets', 'insurance', 'taxes', 'cash', 'delivery', 'education', 'gifts', 'utilities', 'marketplaces',
  'charity', 'fees', 'p2p', 'family', 'installments', 'ownTransfers', 'income', 'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

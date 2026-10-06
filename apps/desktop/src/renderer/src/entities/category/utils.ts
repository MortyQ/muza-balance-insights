import type { CategoryId } from '@contract/categories.ts';
import { t } from '@/shared/lib';
import { COLORED } from './constants.ts';

/** A category the core no longer has comes as its bare word: shown capitalised. */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('uk') + s.slice(1);
}

/** The category's name in the interface language (`home.spending.category.*`); an unknown word — capitalised. */
export function categoryName(c: Readonly<{ category: string; categoryId: CategoryId | null }>): string {
  return c.categoryId ? t(`home.spending.category.${c.categoryId}`) : capitalize(c.category);
}

/** The colour of a category by its 0-based rank in this month's spending (`--category-1…7`), else `--category-other`. */
export function categoryColor(rank: number | null): string {
  return rank !== null && rank < COLORED ? `var(--category-${rank + 1})` : 'var(--category-other)';
}

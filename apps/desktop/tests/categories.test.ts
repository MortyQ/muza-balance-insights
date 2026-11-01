// The category ids the renderer translates are exactly the core's CATEGORY keys, and each has a text.
import { describe, expect, it } from 'vitest';
import { CHOOSABLE_CATEGORIES } from '@mono/core/commands/categories';
import { CATEGORY } from '@mono/core/derive/categories';
import { DEFAULT_KINDS } from '@mono/core/read/category-kinds';
import { CATEGORY_IDS, CHOOSABLE_CATEGORY_IDS, KIND_CATEGORY_IDS } from '../src/shared/categories.ts';
import { MESSAGES } from '../src/shared/i18n/index.ts';
import { LOCALES } from '../src/shared/locale.ts';

describe('spending categories', () => {
  it('CATEGORY_IDS = the keys of the core CATEGORY', () => {
    expect([...CATEGORY_IDS].sort()).toEqual(Object.keys(CATEGORY).sort());
  });

  it('CHOOSABLE_CATEGORY_IDS = the ids of the core CHOOSABLE_CATEGORIES', () => {
    expect(CHOOSABLE_CATEGORY_IDS.map((id) => CATEGORY[id]).sort()).toEqual([...CHOOSABLE_CATEGORIES].sort());
  });

  it('KIND_CATEGORY_IDS = the categories of the core DEFAULT_KINDS', () => {
    expect(KIND_CATEGORY_IDS.map((id) => CATEGORY[id]).sort()).toEqual([...DEFAULT_KINDS.keys()].sort());
  });

  it.each(LOCALES)('%s: a name for every category', (locale) => {
    expect(Object.keys(MESSAGES[locale].home.spending.category).sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it('the Russian names are the core words, capitalised (a renamed one as renamed)', () => {
    const renamed: Partial<Record<keyof typeof CATEGORY, string>> = { travel: 'Путешествия и отпуск' };
    for (const [id, word] of Object.entries(CATEGORY)) {
      const name = renamed[id as keyof typeof CATEGORY];
      if (name) {
        expect(MESSAGES.ru.home.spending.category[id as keyof typeof CATEGORY]).toBe(name);
        continue;
      }
      expect(MESSAGES.ru.home.spending.category[id as keyof typeof CATEGORY]).toBe(word.charAt(0).toUpperCase() + word.slice(1));
    }
  });
});

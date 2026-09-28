// The category ids the renderer translates are exactly the core's CATEGORY keys, and each has a text.
import { describe, expect, it } from 'vitest';
import { CATEGORY } from '@mono/core/categories';
import { CATEGORY_IDS } from '../src/shared/categories.ts';
import { MESSAGES } from '../src/shared/i18n/index.ts';
import { LOCALES } from '../src/shared/locale.ts';

describe('spending categories', () => {
  it('CATEGORY_IDS = the keys of the core CATEGORY', () => {
    expect([...CATEGORY_IDS].sort()).toEqual(Object.keys(CATEGORY).sort());
  });

  it.each(LOCALES)('%s: a name for every category', (locale) => {
    expect(Object.keys(MESSAGES[locale].home.spending.category).sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it('the Russian names are the core words, capitalised', () => {
    for (const [id, word] of Object.entries(CATEGORY)) {
      expect(MESSAGES.ru.home.spending.category[id as keyof typeof CATEGORY]).toBe(word.charAt(0).toUpperCase() + word.slice(1));
    }
  });
});

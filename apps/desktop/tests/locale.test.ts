// The interface language: the user's choice, or the system's when it is one of ours, else Ukrainian.
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, resolveLocale } from '../src/shared/locale.ts';

describe('resolveLocale', () => {
  it('three languages, Ukrainian when nothing matches', () => {
    expect(LOCALES).toEqual(['uk', 'en', 'ru']);
    expect(DEFAULT_LOCALE).toBe('uk');
  });

  it.each([
    [['uk-UA'], 'uk'],
    [['uk'], 'uk'],
    [['en-GB', 'uk-UA'], 'en'],
    [['ru-RU'], 'ru'],
    [['UK-ua'], 'uk'],
    [['de-DE', 'ru-RU', 'uk-UA'], 'ru'],
    [['de-DE', 'fr-FR'], 'uk'],
    [[], 'uk'],
    [['ukr', 'english'], 'uk'],
    [['en-US'], 'en'],
  ])('%j → %s', (languages, locale) => expect(resolveLocale(languages)).toBe(locale));
});

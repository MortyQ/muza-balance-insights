// Main's texts (src/main/i18n.ts): the same dictionaries, read without vue-i18n, so they must stay plain text.
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../src/shared/i18n/index.ts';
import { LOCALES } from '../src/shared/locale.ts';
import { translator, type MainKey } from '../src/main/i18n.ts';

function leaves(node: unknown, prefix: string): Array<[string, string]> {
  if (typeof node === 'string') return [[prefix, node]];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, `${prefix}.${k}`));
}

describe('main texts', () => {
  it.each(LOCALES)('%s: plain text only — no placeholders, plural forms, linked or literal syntax', (locale) => {
    const texts = [...leaves(MESSAGES[locale].main, 'main'), ['common.disclaimer', MESSAGES[locale].common.disclaimer] as [string, string]];
    expect(texts.length).toBeGreaterThan(10);
    expect(texts.filter(([, text]) => /[{}|@]/.test(text))).toEqual([]);
  });

  it.each(LOCALES)('%s: every text is read as it is in the dictionary', (locale) => {
    const t = translator(locale);
    for (const [key, text] of leaves(MESSAGES[locale].main, 'main')) expect(t(key as MainKey)).toBe(text);
    expect(t('common.disclaimer')).toBe(MESSAGES[locale].common.disclaimer);
  });

  it('an unknown key shows as itself, never as an empty label', () => {
    expect(translator('en')('main.nope' as MainKey)).toBe('main.nope');
  });
});

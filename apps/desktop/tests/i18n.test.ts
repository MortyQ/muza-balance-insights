// Interface dictionaries (src/shared/i18n): one JSON per locale, all matching the reference one.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, REFERENCE_LOCALE } from '../src/shared/i18n/index.ts';
import { LOCALES } from '../src/shared/locale.ts';
import { dictionaryProblems } from './helpers/i18n.ts';

const DIR = new URL('../src/shared/i18n/', import.meta.url);

describe('dictionaries', () => {
  it('one JSON file per locale, nothing else', () => {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
    expect(files.sort()).toEqual(LOCALES.map((l) => `${l}.json`).sort());
    expect(Object.keys(MESSAGES).sort()).toEqual([...LOCALES].sort());
  });

  it.each(LOCALES)('%s matches the reference: keys, placeholders, plural forms, no empty texts', (locale) => {
    expect(dictionaryProblems(MESSAGES[REFERENCE_LOCALE], MESSAGES[locale], locale)).toEqual([]);
  });
});

// Invented texts: each breaks one rule.
describe('dictionaryProblems catches', () => {
  const ref = { a: { title: 'Назва', count: '{n} рядок | {n} рядки | {n} рядків' }, hello: 'Привіт, {name}' };
  const good = { a: { title: 'Title', count: '{n} row | {n} rows | {n} rows' }, hello: 'Hi, {name}' };

  it('nothing in a matching dictionary', () => {
    expect(dictionaryProblems(ref, good, 'en')).toEqual([]);
  });

  it.each([
    ['a missing key', { ...good, hello: undefined }, 'en: hello is missing'],
    ['an extra key', { ...good, bye: 'Bye' }, 'en: bye is not in the reference'],
    ['an empty text', { ...good, hello: ' ' }, 'en: hello is empty'],
    ['a renamed placeholder', { ...good, hello: 'Hi, {user}' }, 'en: hello placeholders differ'],
    ['a lost plural form', { ...good, a: { ...good.a, count: '{n} rows' } }, 'en: a.count plural forms differ'],
    ['a number instead of text', { ...good, hello: 1 }, 'hello: expected a string or an object'],
    ['an array', { ...good, a: ['Title'] }, 'a: expected a string or an object'],
  ])('%s', (_name, dict, problem) => {
    expect(dictionaryProblems(ref, JSON.parse(JSON.stringify(dict)), 'en')).toContain(problem);
  });
});

// The prod CSP has no 'unsafe-eval': the vue-i18n code that goes into the bundle must never build code from strings.
describe('vue-i18n in the bundle', () => {
  // Every build each package ships (Vite picks one of them by its export conditions).
  const distOf = (pkg: string, from: string): string => path.join(path.dirname(createRequire(from).resolve(`${pkg}/package.json`)), 'dist');
  const vueI18n = distOf('vue-i18n', import.meta.url);
  const files = [vueI18n, ...['@intlify/core-base', '@intlify/message-compiler', '@intlify/shared'].map((p) => distOf(p, vueI18n))]
    .flatMap((dir) => fs.readdirSync(dir).filter((f) => /\.(m?js|cjs)$/.test(f)).map((f) => path.join(dir, f)));

  it('covers every build, including the one for bundlers', () => {
    expect(files.some((f) => f.endsWith('vue-i18n.esm-bundler.js'))).toBe(true);
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [path.relative(process.cwd(), f), f]))('%s: no new Function, no eval', (_name, file) => {
    const code = fs.readFileSync(file, 'utf8');
    expect(code).not.toMatch(/new Function\b|\beval\s*\(/);
  });
});

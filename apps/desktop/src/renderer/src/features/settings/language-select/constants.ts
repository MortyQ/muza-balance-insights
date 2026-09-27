import type { LanguageOption } from './types.ts';

export const LANGUAGE_OPTIONS = [
  { value: 'uk', label: 'Українська', country: 'UA' },
  { value: 'en', label: 'English', country: 'GB' },
  { value: 'ru', label: 'Русский', country: 'RU' },
] as const satisfies ReadonlyArray<LanguageOption>;

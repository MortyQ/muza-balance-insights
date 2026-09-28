// The interface language. No dependencies: shared by main, preload and renderer.

export const LOCALES = ['uk', 'en', 'ru'] as const;

export type Locale = (typeof LOCALES)[number];

/** When none of the system's languages is ours. */
export const DEFAULT_LOCALE: Locale = 'uk';

/** The first system language we have, by its primary subtag («uk-UA» → uk); else Ukrainian. */
export function resolveLocale(systemLanguages: ReadonlyArray<string>): Locale {
  for (const tag of systemLanguages) {
    const primary = tag.split('-')[0]?.toLowerCase();
    const found = LOCALES.find((l) => l === primary);
    if (found) return found;
  }
  return DEFAULT_LOCALE;
}

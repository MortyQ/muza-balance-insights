import type { Ref } from 'vue';
import type { Locale } from '@contract/locale.ts';

export interface LanguageOption {
  value: Locale;
  /** The language's own name: it reads the same whatever the interface language is. */
  label: string;
  /** ISO 3166-1 alpha-2 of the flag. Not an emoji: Windows shows flag emoji as two letters. */
  country: 'UA' | 'GB' | 'RU';
}

export interface UseLocaleReturn {
  /** null until main has answered. */
  locale: Readonly<Ref<Locale | null>>;
  error: Readonly<Ref<string>>;
  select: (locale: Locale) => Promise<void>;
}

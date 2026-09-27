// Interface texts: one JSON dictionary per locale, nested keys («settings.language.title»), vue-i18n message syntax
// ({name} placeholders, plural forms split by «|»). uk.json is the reference: it sets the keys and the types;
// tests/i18n.test.ts checks that the other dictionaries match it. Not translated yet: the dictionaries stay empty
// until the screens settle.
import type { Locale } from '../locale.ts';
import en from './en.json' with { type: 'json' };
import ru from './ru.json' with { type: 'json' };
import uk from './uk.json' with { type: 'json' };

export type Messages = typeof uk;

/** Every leaf path of the reference dictionary: «settings.language.title». */
export type MessageKey = LeafPaths<Messages>;

type LeafPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export const REFERENCE_LOCALE: Locale = 'uk';

export const MESSAGES: Record<Locale, Messages> = { uk, en, ru };

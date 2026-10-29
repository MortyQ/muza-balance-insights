// Category hints from the merchant text, for a bank that states neither an MCC nor a category of its own. Chains and
// brands only, never a small local place; the list was approved in the review of change core-slsp-statements. An
// entry matches its words as whole words of the normalised text (`first`: at its start); the first match wins, so a
// more specific entry comes before a general one. `hint: null` = known, no category (a kiosk named after a
// supermarket).
import type { CategoryHint } from '../types.ts';

type Entry = { words: string; hint: CategoryHint | null; first?: true };

export const MERCHANTS: readonly Entry[] = [
  { words: 'TABAK PRESS', hint: null },
  { words: 'GECO TABAK', hint: null },
  { words: 'TRAFIKA', hint: null },
  { words: 'BILLA', hint: 'groceries' },
  { words: 'LIDL', hint: 'groceries' },
  { words: 'TESCO', hint: 'groceries' },
  { words: 'TERNO', hint: 'groceries' },
  { words: 'MCDONALD S', hint: 'cafes' },
  { words: 'KFC', hint: 'cafes' },
  { words: 'WOLT', hint: 'delivery' },
  { words: 'BOLT', hint: 'transport' },
  { words: 'IDS BK', hint: 'transport' },
  { words: 'REKOLA', hint: 'transport' },
  { words: 'NEXTBIKE', hint: 'transport' },
  { words: 'OMV', hint: 'transport' },
  { words: 'ORANGE', hint: 'telecom' },
  { words: 'ALZA', hint: 'marketplaces' },
  { words: 'ALLEGRO', hint: 'marketplaces' },
  { words: 'DM', hint: 'beauty', first: true },
  { words: 'DR MAX', hint: 'health' },
  { words: 'LEKAREN', hint: 'health' },
  { words: 'APTEKA', hint: 'health' },
  { words: 'RESERVED', hint: 'clothing' },
  { words: 'CINEMA CITY', hint: 'entertainment' },
  { words: 'CINEMACITY', hint: 'entertainment' },
  { words: 'YOUTUBEPREMIUM', hint: 'entertainment' },
  { words: 'IKEA', hint: 'home' },
  { words: 'BIOTECH USA', hint: 'sport' },
  { words: 'PLAVAREN', hint: 'sport' },
];

/** Upper case without diacritics, every run of other characters than letters and digits one space. */
export const merchantWords = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/** The hint of the first entry the text matches; null when none does or the entry has none. */
export function merchantHint(text: string): CategoryHint | null {
  const words = merchantWords(text);
  const padded = ` ${words} `;
  const entry = MERCHANTS.find((e) => (e.first ? `${words} `.startsWith(`${e.words} `) : padded.includes(` ${e.words} `)));
  return entry?.hint ?? null;
}

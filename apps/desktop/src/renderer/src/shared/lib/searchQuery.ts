// The global search's input taken apart (spec desktop-global-search): dates («12 Oct», «5–11 Oct», «October 2026»,
// month names in English, Ukrainian and Russian, any interface language), one amount («250», «250,50») and the text
// left. Pure: `today` (YYYY-MM-DD, system time zone) decides the year a date without one falls in.

export type ParsedSearch = {
  /** What is left once the dates and the amount are taken out, single spaces; '' — none. */
  text: string;
  /** Days, YYYY-MM-DD, inclusive; null — no date in the input. */
  from: string | null;
  to: string | null;
  /** The amount typed, in units of the main currency; null — none. */
  amount: number | null;
};

/** Full month names (nominative and genitive): each is a date even alone («October», «жовтень»). */
const FULL: ReadonlyArray<ReadonlyArray<string>> = [
  ['january', 'січень', 'січня', 'январь', 'января'],
  ['february', 'лютий', 'лютого', 'февраль', 'февраля'],
  ['march', 'березень', 'березня', 'март', 'марта'],
  ['april', 'квітень', 'квітня', 'апрель', 'апреля'],
  ['may', 'травень', 'травня', 'май', 'мая'],
  ['june', 'червень', 'червня', 'июнь', 'июня'],
  ['july', 'липень', 'липня', 'июль', 'июля'],
  ['august', 'серпень', 'серпня', 'август', 'августа'],
  ['september', 'вересень', 'вересня', 'сентябрь', 'сентября'],
  ['october', 'жовтень', 'жовтня', 'октябрь', 'октября'],
  ['november', 'листопад', 'листопада', 'ноябрь', 'ноября'],
  ['december', 'грудень', 'грудня', 'декабрь', 'декабря'],
];

/** Short names: a date only next to a day or a year («12 жовт», «Oct 2026»), else they stay text. */
const SHORT: ReadonlyArray<ReadonlyArray<string>> = [
  ['jan', 'січ', 'янв'],
  ['feb', 'лют', 'фев'],
  ['mar', 'бер', 'мар'],
  ['apr', 'квіт', 'кві', 'апр'],
  ['трав', 'тра'],
  ['jun', 'черв', 'чер', 'июн'],
  ['jul', 'лип', 'июл'],
  ['aug', 'серп', 'сер', 'авг'],
  ['sep', 'sept', 'вер', 'сен', 'сент'],
  ['oct', 'жовт', 'жов', 'окт'],
  ['nov', 'лист', 'лис', 'ноя'],
  ['dec', 'груд', 'гру', 'дек'],
];

const MONTH_OF = new Map<string, number>();
FULL.forEach((words, i) => words.forEach((w) => MONTH_OF.set(w, i + 1)));
SHORT.forEach((words, i) => words.forEach((w) => MONTH_OF.set(w, i + 1)));

const byLength = (words: Iterable<string>) => [...words].sort((a, b) => b.length - a.length).join('|');
/** Any month word, an optional dot after a short one. */
const M = `(${byLength(MONTH_OF.keys())})\\.?`;
const MF = `(${byLength(FULL.flat())})`;
const D = '(\\d{1,2})';
const Y = '(\\d{4})';
const DASH = '\\s*[-–—]\\s*';
// Word edges that work for Cyrillic too (\b does not).
const B = '(?<![\\p{L}\\d])';
const E = '(?![\\p{L}\\d])';

type Found = { from: string; to: string } | null;
type Rule = { re: RegExp; dates: (m: RegExpExecArray, today: string) => Found };

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthNo = (w: string | undefined) => MONTH_OF.get((w ?? '').toLocaleLowerCase('uk')) ?? 0;

/** The year of a month without one: this year, unless that month is still to come — then last year. */
function yearOf(month: number, today: string, year: string | undefined): number {
  if (year !== undefined) return Number(year);
  const [y, m] = today.split('-').map(Number) as [number, number];
  return month > m ? y - 1 : y;
}

function day(y: number, m: number, d: number): string | null {
  return m >= 1 && m <= 12 && d >= 1 && d <= lastDay(y, m) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

function span(from: string | null, to: string | null): Found {
  return from !== null && to !== null && from <= to ? { from, to } : null;
}

const RULES: ReadonlyArray<Rule> = [
  // «28 Oct – 3 Nov [2026]»
  {
    re: new RegExp(`${B}${D}\\s+${M}${DASH}${D}\\s+${M}(?:\\s+${Y})?${E}`, 'iu'),
    dates: (m, today) => {
      const m1 = monthNo(m[2]);
      const m2 = monthNo(m[4]);
      const y2 = yearOf(m2, today, m[5]);
      const y1 = m1 > m2 ? y2 - 1 : y2;
      return span(day(y1, m1, Number(m[1])), day(y2, m2, Number(m[3])));
    },
  },
  // «5–11 Oct [2026]»
  {
    re: new RegExp(`${B}${D}${DASH}${D}\\s+${M}(?:\\s+${Y})?${E}`, 'iu'),
    dates: (m, today) => {
      const mo = monthNo(m[3]);
      const y = yearOf(mo, today, m[4]);
      return span(day(y, mo, Number(m[1])), day(y, mo, Number(m[2])));
    },
  },
  // «12 Oct [2026]»
  {
    re: new RegExp(`${B}${D}\\s+${M}(?:\\s+${Y})?${E}`, 'iu'),
    dates: (m, today) => {
      const mo = monthNo(m[2]);
      const d = day(yearOf(mo, today, m[3]), mo, Number(m[1]));
      // A day still to come without a year: the same day a year back.
      if (d !== null && m[3] === undefined && d > today) return span(day(Number(d.slice(0, 4)) - 1, mo, Number(m[1])), day(Number(d.slice(0, 4)) - 1, mo, Number(m[1])));
      return span(d, d);
    },
  },
  // «October 2026», «Oct 2026»
  {
    re: new RegExp(`${B}${M}\\s+${Y}${E}`, 'iu'),
    dates: (m) => {
      const mo = monthNo(m[1]);
      const y = Number(m[2]);
      return span(day(y, mo, 1), day(y, mo, lastDay(y, mo)));
    },
  },
  // «October», «жовтень» alone
  {
    re: new RegExp(`${B}${MF}${E}`, 'iu'),
    dates: (m, today) => {
      const mo = monthNo(m[1]);
      const y = yearOf(mo, today, undefined);
      return span(day(y, mo, 1), day(y, mo, lastDay(y, mo)));
    },
  },
];

const AMOUNT = /^\d+(?:[.,]\d{1,2})?$/;

/** The input taken apart: the first date found, a single number as the amount, the rest as text. */
export function parseSearch(input: string, today: string): ParsedSearch {
  let rest = input.replace(/\s+/g, ' ').trim();
  let from: string | null = null;
  let to: string | null = null;
  for (const rule of RULES) {
    const m = rule.re.exec(rest);
    const found = m ? rule.dates(m, today) : null;
    if (m && found) {
      ({ from, to } = found);
      rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`;
      break;
    }
  }
  const words = rest.split(' ').filter(Boolean);
  const numbers = words.filter((w) => AMOUNT.test(w));
  const amount = numbers.length === 1 ? Number(numbers[0]!.replace(',', '.')) : null;
  const text = (amount === null ? words : words.filter((w) => w !== numbers[0])).join(' ');
  return { text, from, to, amount };
}

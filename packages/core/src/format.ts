import { TZDate } from '@date-fns/tz';
import { TIMEZONE } from './constants.ts';
import { currencyAlpha } from './currency.ts';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parses a strict `YYYY-MM-DD` (rejects e.g. 2025-02-30). Returns null if invalid. */
export function parseLocalDate(s: string): { y: number; m: number; d: number } | null {
  const match = DATE_RE.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Unix seconds of 00:00 of the given Kyiv calendar date. */
export function kyivStartOfDay(date: string): number {
  const p = parseLocalDate(date);
  if (!p) throw new RangeError(`Некорректная дата "${date}", ожидается YYYY-MM-DD`);
  return Math.floor(new TZDate(p.y, p.m - 1, p.d, TIMEZONE).getTime() / 1000);
}

/** Kyiv calendar date (`YYYY-MM-DD`) of a unix-seconds instant. */
export function toKyivDate(unixSec: number): string {
  const t = new TZDate(unixSec * 1000, TIMEZONE);
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

/** Kyiv local date-time `YYYY-MM-DD HH:mm` for human-readable output. */
export function toKyivDateTime(unixSec: number): string {
  const t = new TZDate(unixSec * 1000, TIMEZONE);
  return `${toKyivDate(unixSec)} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
}

/** Human-readable duration for progress output: "45 с", "3 мин", "1 ч 20 мин". */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} с`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

export { currencyAlpha } from './currency.ts';

/** Minor units → "1234.56" / "-0.05" using integer arithmetic only (no float rounding). */
export function formatMinor(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError('Сумма должна быть целым числом в копейках');
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Log labels for accounts: type + currency ("black/UAH", "банка/UAH") — never a card number or IBAN.
 * Duplicate labels get the first 4 characters of the account id ("black/UAH #ab12").
 */
export function accountLabels(
  accounts: ReadonlyArray<{ id: string; kind: string; type: string | null; currencyCode: number }>,
): Map<string, string> {
  const base = new Map(
    accounts.map((a) => [a.id, `${a.kind === 'jar' ? 'банка' : (a.type ?? 'карта')}/${currencyAlpha(a.currencyCode)}`]),
  );
  const counts = new Map<string, number>();
  for (const l of base.values()) counts.set(l, (counts.get(l) ?? 0) + 1);
  return new Map([...base].map(([id, l]) => [id, (counts.get(l) ?? 0) > 1 ? `${l} #${id.slice(0, 4)}` : l]));
}

/**
 * counter_name as MCP tools show it: initials only («Олена Тестова» → «О. Т.», at most 3 words; quotes and
 * legal forms are words too). The full name is shown only when the user turned on settings.reveal_full_names —
 * never by a tool parameter. Blank → null.
 */
export function displayCounterName(name: string | null, revealFullNames: boolean): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (revealFullNames) return trimmed;
  const initials = trimmed
    .split(/\s+/)
    .map((w) => w.match(/\p{L}|\p{N}/u)?.[0])
    .filter((c): c is string => !!c)
    .slice(0, 3);
  return initials.length > 0 ? initials.map((c) => `${c.toLocaleUpperCase('uk')}.`).join(' ') : null;
}

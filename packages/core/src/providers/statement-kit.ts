// What statement readers of every bank share: the document as a grid of cell texts, column names compared in one
// shape, times in the statement's wall clock (text or an Excel serial), empty rows. Pure; a bank's reader keeps only
// its own columns and texts.
import { TZDate } from '@date-fns/tz';
import { TIMEZONE } from '../shared/constants.ts';
import { parseCsv } from '../shared/csv.ts';
import { excelSerialToUnix } from '../shared/excel-date.ts';
import type { StatementDocument } from './types.ts';

/**
 * The document's table as cell texts: a CSV text, or the first sheet of a workbook (an empty cell → ''). Null when it
 * is a PDF, not CSV, or a workbook without sheets.
 */
export function gridOf(doc: StatementDocument): string[][] | null {
  if (doc.format === 'text') {
    try {
      return parseCsv(doc.text);
    } catch {
      return null;
    }
  }
  if (doc.format === 'sheets') {
    const sheet = doc.sheets[0];
    return sheet ? sheet.rows.map((row) => row.map((cell) => cell?.v ?? '')) : null;
  }
  return null;
}

/** Column names compared in one shape: lower case, one space, the Latin «i» a bank may type as the word «і». */
export const normHeader = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(?<= )i(?= )/g, 'і');

/**
 * Where each field's column is: every field's pattern must match exactly one header (normalised), else null. Patterns
 * may capture (e.g. a currency in the name); the match is returned with the index.
 */
export function columnsByHeader<F extends string>(
  header: readonly string[],
  spec: ReadonlyArray<{ field: F; re: RegExp }>,
): Record<F, { index: number; match: RegExpExecArray }> | null {
  const names = header.map(normHeader);
  const out = {} as Record<F, { index: number; match: RegExpExecArray }>;
  for (const { field, re } of spec) {
    const found = names.flatMap((n, index) => {
      const match = re.exec(n);
      return match ? [{ index, match }] : [];
    });
    if (found.length !== 1) return null;
    out[field] = found[0]!;
  }
  return out;
}

const TIME_RE = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * `dd.MM.yyyy HH:mm[:ss]` in the statement's wall clock (Kyiv) → unix seconds; an Excel serial cell the same way.
 * Null if it is not a real moment.
 */
export function wallTime(s: string, timeZone: string = TIMEZONE): number | null {
  const text = s.trim();
  const m = TIME_RE.exec(text);
  if (!m) return excelSerialToUnix(text, timeZone);
  const [d, mo, y, h, mi, se] = m.slice(1).map((v) => Number(v ?? 0)) as [number, number, number, number, number, number];
  const t = new TZDate(y, mo - 1, d, h, mi, se, timeZone);
  if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d || t.getHours() !== h || t.getMinutes() !== mi || t.getSeconds() !== se) {
    return null;
  }
  return Math.floor(t.getTime() / 1000);
}

/** A row with no text in any cell (a formatted but empty spreadsheet row). */
export const isEmptyRow = (cells: readonly string[]) => cells.every((c) => c.trim() === '');

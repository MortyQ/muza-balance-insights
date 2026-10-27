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

/**
 * Column names compared in one shape: composed letters (a «ї» may come as «і» + a combining diaeresis), lower case,
 * one space, the Latin «i» a bank may type as the word «і».
 */
export const normHeader = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().replace(/(?<= )i(?= )/g, 'і');

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

const GROUP_SPACE_RE = /(?<=\d)[    ](?=\d{3}(?:\D|$))/g;

/**
 * An amount as a statement writes it — `-1 234,56` (any space between thousands, a decimal comma) or the stored number
 * `-1234.56` — in the form `toMinor` reads; null when it is not one.
 */
export function localAmount(s: string): string | null {
  const text = s.trim().replace(GROUP_SPACE_RE, '');
  if (/^-?\d+(?:,\d+)?$/.test(text)) return text.replace(',', '.');
  return /^-?\d+(?:\.\d+)?$/.test(text) ? text : null;
}

export type PdfItem = { x: number; y: number; w: number; h: number; text: string };
export type PdfLine = { y: number; items: PdfItem[] };

/** A page's items as lines: baselines within `tolerance` points are one line; lines top down, items left to right. */
export function pdfLines(items: readonly PdfItem[], tolerance = 2): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = lines.at(-1);
    if (last && item.y - last.y <= tolerance) last.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

/** A line's texts, items closer than `gap` points joined with a space: a label and its value stay together, columns apart. */
export function lineSegments(line: PdfLine, gap = 12): string[] {
  const out: string[] = [];
  let end = -Infinity;
  for (const item of line.items) {
    if (out.length > 0 && item.x - end < gap) out[out.length - 1] += ` ${item.text}`;
    else out.push(item.text);
    end = item.x + item.w;
  }
  return out.map((s) => s.replace(/\s+/g, ' ').trim());
}

type Span = { from: number; to: number };

/** Items of a header band as columns: items whose horizontal spans overlap are one column, its text read top down. */
function headerColumns(lines: readonly PdfLine[]): Array<{ span: Span; text: string }> {
  const cols: Array<{ span: Span; items: PdfItem[] }> = [];
  for (const item of lines.flatMap((l) => l.items)) {
    const span = { from: item.x, to: item.x + item.w };
    const hit = cols.filter((c) => span.from < c.span.to && c.span.from < span.to);
    const merged = { span, items: [item] };
    for (const c of hit) {
      merged.span = { from: Math.min(merged.span.from, c.span.from), to: Math.max(merged.span.to, c.span.to) };
      merged.items.push(...c.items);
      cols.splice(cols.indexOf(c), 1);
    }
    cols.push(merged);
  }
  return cols
    .sort((a, b) => a.span.from - b.span.from)
    .map((c) => ({ span: c.span, text: c.items.sort((a, b) => a.y - b.y || a.x - b.x).map((i) => i.text).join(' ') }));
}

const MAX_HEADER_LINES = 6;

/** The first band of up to six lines on a page whose columns are exactly the spec's fields, or null. */
function findHeader<F extends string>(lines: readonly PdfLine[], spec: ReadonlyArray<{ field: F; re: RegExp }>) {
  for (let i = 0; i < lines.length; i++) {
    for (let k = 1; k <= MAX_HEADER_LINES && i + k <= lines.length; k++) {
      const band = lines.slice(i, i + k);
      const cols = headerColumns(band);
      if (cols.length !== spec.length) continue;
      const found = columnsByHeader(cols.map((c) => c.text), spec);
      if (found) return { first: i, last: i + k - 1, spans: cols.map((c) => c.span), names: cols.map((c) => c.text), found };
    }
  }
  return null;
}

const centre = (i: PdfItem) => i.x + i.w / 2;
const distance = (x: number, s: Span) => (x < s.from ? s.from - x : x > s.to ? x - s.to : 0);

/** The column an item belongs to: the one whose header span is nearest to the item's centre (inside it = 0). */
function columnOf(item: PdfItem, spans: readonly Span[]): number {
  let best = 0;
  for (let c = 1; c < spans.length; c++) {
    const x = centre(item);
    const d = distance(x, spans[c]!) - distance(x, spans[best]!);
    if (d < 0 || (d === 0 && Math.abs(x - (spans[c]!.from + spans[c]!.to) / 2) < Math.abs(x - (spans[best]!.from + spans[best]!.to) / 2))) best = c;
  }
  return best;
}

export type PdfTable<F extends string> = {
  /** Each field's header text match (its captures). */
  header: Record<F, RegExpExecArray>;
  /** Each field's header as the file writes it, its lines joined. */
  names: Record<F, string>;
  /** Page 1's text above the first table header, as `lineSegments`, top down. */
  heading: string[];
  /** The operations, in the file's order: each field's text, a cell's lines joined top down. */
  rows: Array<Record<F, string>>;
};

/**
 * A table set over PDF pages: the header (repeated on each page, or once and continued) is found by its column names
 * over up to six lines. A row is anchored by a line whose `anchor` column matches `anchorRe`; its cells are every item
 * between the midpoints to the neighbouring anchors (half the usual row spacing past the first and the last), so a
 * date over its time or a wrapped description reads as one cell. Null when no page has the header.
 */
export function pdfTable<F extends string>(
  doc: StatementDocument,
  spec: ReadonlyArray<{ field: F; re: RegExp }>,
  anchor: F,
  anchorRe: RegExp,
): PdfTable<F> | null {
  if (doc.format !== 'pdf') return null;
  const fields = spec.map((s) => s.field);
  let header: ReturnType<typeof findHeader<F>> = null;
  let heading: string[] | null = null;
  const pages: Array<{ lines: PdfLine[]; spans: Span[]; columns: number[] }> = [];
  for (const page of doc.pages) {
    const lines = pdfLines(page.items);
    const found = findHeader(lines, spec);
    if (found) {
      header ??= found;
      heading ??= lines.slice(0, found.first).flatMap((l) => lineSegments(l));
    }
    const current = found ?? header;
    if (!current) continue;
    pages.push({ lines: found ? lines.slice(found.last + 1) : lines, spans: current.spans, columns: fields.map((f) => current.found[f].index) });
  }
  if (!header || !heading) return null;

  // Anchors per page, then the usual spacing between them.
  const anchored = pages.map((p) => {
    const at = p.columns[fields.indexOf(anchor)]!;
    return p.lines.filter((l) => l.items.some((i) => columnOf(i, p.spans) === at && anchorRe.test(i.text.trim()))).map((l) => l.y);
  });
  const gaps = anchored.flatMap((ys) => ys.slice(1).map((y, i) => y - ys[i]!)).sort((a, b) => a - b);
  const lineH = Math.max(1, ...pages.flatMap((p) => p.lines.flatMap((l) => l.items.map((i) => i.h))));
  const half = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)]! / 2 : lineH * 1.5;

  const rows: Array<Record<F, string>> = [];
  for (const [n, p] of pages.entries()) {
    const ys = anchored[n]!;
    for (const [k, y] of ys.entries()) {
      const top = k === 0 ? y - half : (ys[k - 1]! + y) / 2;
      const bottom = k === ys.length - 1 ? y + half : (y + ys[k + 1]!) / 2;
      const cells = fields.map(() => [] as PdfItem[]);
      for (const line of p.lines) {
        if (line.y <= top || line.y > bottom) continue;
        for (const item of line.items) {
          const at = p.columns.indexOf(columnOf(item, p.spans));
          if (at >= 0) cells[at]!.push(item);
        }
      }
      rows.push(Object.fromEntries(fields.map((f, c) => [f, cells[c]!.map((i) => i.text.trim()).join(' ')])) as Record<F, string>);
    }
  }
  const h = header;
  return {
    header: Object.fromEntries(fields.map((f) => [f, h.found[f].match])) as Record<F, RegExpExecArray>,
    names: Object.fromEntries(fields.map((f) => [f, h.names[h.found[f].index]!])) as Record<F, string>,
    heading,
    rows,
  };
}

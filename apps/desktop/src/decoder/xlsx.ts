// A workbook (.xlsx) → sheets of typed cell texts. Only the parts that hold cells are inflated: the workbook (sheet
// names and order), its relationships (which part is which sheet), the shared strings and the sheets. Their declared
// inflated size is summed before anything is inflated, and fflate inflates each part into a buffer of its declared
// size, so a zip bomb stops at DECODE_LIMITS.unpackedBytes. Formulas are not evaluated: a cell holds its cached value.
// External links, styles, macros and everything else in the archive are never read. Numbers stay the stored text;
// a date is a number (an Excel serial) the reader turns into a time.
import { unzipSync, type UnzipFileInfo } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import type { Cell } from '@mono/core/providers/types';
import { DECODE_LIMITS, type DecodeFailure, type DecodeResult } from '../shared/decoder-protocol.ts';

const WORKBOOK = 'xl/workbook.xml';
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels';
const SHARED_STRINGS = 'xl/sharedStrings.xml';
const SHEET_RE = /^xl\/worksheets\/[^/]+\.xml$/;

const wanted = (name: string) => name === WORKBOOK || name === WORKBOOK_RELS || name === SHARED_STRINGS || SHEET_RE.test(name);

class Refused extends Error {
  constructor(readonly code: DecodeFailure) {
    super(code);
  }
}

/** Elements that may repeat; everything else is read as one. */
const LISTS = new Set(['sheet', 'Relationship', 'si', 'r', 'row', 'c']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  htmlEntities: false,
  maxNestedTags: 100,
  isArray: (name) => LISTS.has(name),
});

type Node = Record<string, unknown>;

function parse(bytes: Uint8Array | undefined): Node | null {
  if (!bytes) return null;
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  // A workbook part never declares a DOCTYPE; one that does is not ours (and no entity of it is expanded).
  if (/<!DOCTYPE/i.test(text)) throw new Refused('unreadable');
  return parser.parse(text) as Node;
}

const asNode = (v: unknown): Node | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Node) : null);
const list = (v: unknown): Node[] => (Array.isArray(v) ? v.map(asNode).filter((n) => n !== null) : []);
const attr = (n: Node | null, name: string): string | null => {
  const v = n?.[`@_${name}`];
  return typeof v === 'string' ? v : null;
};

/** The text of an element: a plain string, or `#text` next to its attributes. */
function textOf(v: unknown): string {
  if (typeof v === 'string') return v;
  const n = asNode(v);
  const t = n?.['#text'];
  return typeof t === 'string' ? t : '';
}

/** A shared or inline string: its `t`, or the `t` of each run (phonetic runs `rPh` left out). */
function stringOf(si: Node | null): string {
  if (!si) return '';
  if (si.t !== undefined) return textOf(si.t);
  return list(si.r)
    .map((r) => textOf(r.t))
    .join('');
}

/** `B12` → column index 1; null if it is not a cell reference. */
function columnOf(ref: string | null): number | null {
  const m = /^([A-Z]{1,3})\d+$/.exec(ref ?? '');
  if (!m?.[1]) return null;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function cellOf(c: Node, shared: readonly string[]): Cell {
  const type = attr(c, 't');
  const v = textOf(c.v);
  let cell: Cell;
  if (type === 's') {
    const s = shared[Number(v)];
    cell = /^\d+$/.test(v) && s !== undefined ? { t: 's', v: s } : null;
  } else if (type === 'inlineStr') {
    cell = { t: 's', v: stringOf(asNode(c.is)) };
  } else if (type === 'str' || type === 'd') {
    cell = { t: 's', v };
  } else if (type === 'b') {
    cell = v === '1' || v === '0' ? { t: 'b', v } : null;
  } else if (type === 'e') {
    cell = null;
  } else {
    cell = v === '' ? null : { t: 'n', v };
  }
  if (cell && cell.v.length > DECODE_LIMITS.cellChars) throw new Refused('too-long');
  return cell;
}

export function decodeXlsx(bytes: Uint8Array): DecodeResult {
  try {
    // The archive's directory first: what it declares, nothing inflated yet.
    const declared: UnzipFileInfo[] = [];
    unzipSync(bytes, {
      filter: (f) => {
        if (wanted(f.name)) declared.push(f);
        return false;
      },
    });
    if (!declared.some((f) => f.name === WORKBOOK)) return { ok: false, code: 'unreadable' };
    if (declared.reduce((n, f) => n + f.originalSize, 0) > DECODE_LIMITS.unpackedBytes) return { ok: false, code: 'too-large' };
    const parts = unzipSync(bytes, { filter: (f) => wanted(f.name) });

    const shared = list(asNode(parse(parts[SHARED_STRINGS])?.sst)?.si).map(stringOf);
    for (const s of shared) if (s.length > DECODE_LIMITS.cellChars) throw new Refused('too-long');

    const targets = new Map<string, string>();
    for (const r of list(asNode(parse(parts[WORKBOOK_RELS])?.Relationships)?.Relationship)) {
      const id = attr(r, 'Id');
      const target = attr(r, 'Target');
      if (id === null || target === null || attr(r, 'TargetMode') === 'External') continue;
      targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    }
    const listed = list(asNode(asNode(parse(parts[WORKBOOK])?.workbook)?.sheets)?.sheet);
    if (listed.length > DECODE_LIMITS.sheets) return { ok: false, code: 'too-many-sheets' };

    let cells = 0;
    const sheets: Array<{ name: string; rows: Cell[][] }> = [];
    for (const s of listed) {
      const part = targets.get(attr(s, 'id') ?? '');
      const xml = part === undefined || !SHEET_RE.test(part) ? null : parse(parts[part]);
      const rows: Cell[][] = [];
      for (const row of list(asNode(asNode(xml?.worksheet)?.sheetData)?.row)) {
        const index = Number(attr(row, 'r') ?? rows.length + 1) - 1;
        if (!Number.isSafeInteger(index) || index < rows.length) return { ok: false, code: 'unreadable' };
        // Rows the sheet leaves out are empty rows; each counts.
        cells += index - rows.length;
        if (cells > DECODE_LIMITS.cells) return { ok: false, code: 'too-many-cells' };
        while (rows.length < index) rows.push([]);
        const out: Cell[] = [];
        for (const c of list(row.c)) {
          const col = columnOf(attr(c, 'r')) ?? out.length;
          if (col < out.length) return { ok: false, code: 'unreadable' };
          while (out.length < col) out.push(null);
          out.push(cellOf(c, shared));
        }
        cells += Math.max(out.length, 1);
        if (cells > DECODE_LIMITS.cells) return { ok: false, code: 'too-many-cells' };
        rows.push(out);
      }
      sheets.push({ name: (attr(s, 'name') ?? '').slice(0, 100), rows });
    }
    return { ok: true, document: { format: 'sheets', sheets } };
  } catch (err) {
    return { ok: false, code: err instanceof Refused ? err.code : 'unreadable' };
  }
}

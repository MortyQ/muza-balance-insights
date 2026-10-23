// The statement decoder's halves (src/decoder/xlsx.ts, pdf.ts) and the schema main checks its reply with. Every file is
// made here: a zip of hand-written workbook XML, a hand-written PDF. Invented content only.
import { strToU8, zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeXlsx } from '../src/decoder/xlsx.ts';
import { decodePdf } from '../src/decoder/pdf.ts';
import { DECODE_LIMITS, DecodedDocumentSchema, FromDecoder } from '../src/shared/decoder-protocol.ts';
import { fictionalPdf } from './helpers/pdf.ts';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** A workbook of the given sheets (name → the inner XML of sheetData) and shared strings (the inner XML of sst). */
function workbook(sheets: Record<string, string>, shared = '', extra: Zippable = {}): Uint8Array {
  const names = Object.keys(sheets);
  const files: Zippable = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook ${NS}><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}</Relationships>`,
    ),
    'xl/sharedStrings.xml': strToU8(`<?xml version="1.0"?><sst ${NS}>${shared}</sst>`),
    ...extra,
  };
  names.forEach((n, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<?xml version="1.0"?><worksheet ${NS}><sheetData>${sheets[n]}</sheetData></worksheet>`);
  });
  return zipSync(files, { level: 1 });
}

describe('decodeXlsx', () => {
  it('cells as typed text: shared and inline strings, numbers as stored, booleans, cached formula values; gaps are empty', () => {
    const bytes = workbook(
      {
        Statement: `
          <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
          <row r="3">
            <c r="A3"><v>45200.5</v></c>
            <c r="B3"><v>-845.5</v></c>
            <c r="C3" t="b"><v>1</v></c>
            <c r="D3" t="inlineStr"><is><t>Inline &amp; fictional</t></is></c>
            <c r="E3"><f>1+2</f><v>3</v></c>
            <c r="F3" t="str"><f>"a"&amp;"b"</f><v>ab</v></c>
            <c r="G3" t="e"><v>#DIV/0!</v></c>
            <c r="H3" t="s"><v>2</v></c>
          </row>`,
        Empty: '',
      },
      '<si><t>Дата операції</t></si><si><r><t>Вигаданий </t></r><r><rPr/><t>магазин</t></r><rPh><t>x</t></rPh></si><si><t xml:space="preserve">  spaced  </t></si>',
    );
    expect(decodeXlsx(bytes)).toEqual({
      ok: true,
      document: {
        format: 'sheets',
        sheets: [
          {
            name: 'Statement',
            rows: [
              [{ t: 's', v: 'Дата операції' }, null, { t: 's', v: 'Вигаданий магазин' }],
              [],
              [
                { t: 'n', v: '45200.5' },
                { t: 'n', v: '-845.5' },
                { t: 'b', v: '1' },
                { t: 's', v: 'Inline & fictional' },
                { t: 'n', v: '3' },
                { t: 's', v: 'ab' },
                null,
                { t: 's', v: '  spaced  ' },
              ],
            ],
          },
          { name: 'Empty', rows: [] },
        ],
      },
    });
  });

  it('a zip bomb is refused by its declared size, before anything is inflated', () => {
    const big = new Uint8Array(DECODE_LIMITS.unpackedBytes + 1).fill(0x20);
    const bytes = workbook({ S: '' }, '', { 'xl/worksheets/sheet9.xml': big });
    expect(bytes.byteLength).toBeLessThan(1024 * 1024);
    expect(decodeXlsx(bytes)).toEqual({ ok: false, code: 'too-large' });
  });

  it('parts the decoder has no use for are never inflated, even when large', () => {
    const big = new Uint8Array(DECODE_LIMITS.unpackedBytes + 1).fill(0x20);
    expect(decodeXlsx(workbook({ S: '<row r="1"><c r="A1"><v>1</v></c></row>' }, '', { 'xl/media/image1.png': big })).ok).toBe(true);
  });

  it('limits are refused with their codes', () => {
    const many = Object.fromEntries(Array.from({ length: DECODE_LIMITS.sheets + 1 }, (_, i) => [`S${i}`, '']));
    expect(decodeXlsx(workbook(many))).toEqual({ ok: false, code: 'too-many-sheets' });
    // One cell on a far row: the rows left out count.
    expect(decodeXlsx(workbook({ S: `<row r="${DECODE_LIMITS.cells + 1}"><c r="A${DECODE_LIMITS.cells + 1}"><v>1</v></c></row>` }))).toEqual({
      ok: false,
      code: 'too-many-cells',
    });
    // The last column on every sheet: the empty cells before it count.
    const far = '<row r="1"><c r="XFD1"><v>1</v></c></row>';
    expect(decodeXlsx(workbook(Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`S${i}`, far]))))).toEqual({ ok: false, code: 'too-many-cells' });
    expect(decodeXlsx(workbook({ S: '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' }, `<si><t>${'x'.repeat(DECODE_LIMITS.cellChars + 1)}</t></si>`))).toEqual({
      ok: false,
      code: 'too-long',
    });
  });

  it('not a workbook, a DOCTYPE, rows out of order: unreadable', () => {
    expect(decodeXlsx(strToU8('a,b,c\n'))).toEqual({ ok: false, code: 'unreadable' });
    expect(decodeXlsx(zipSync({ 'readme.txt': strToU8('fictional') }))).toEqual({ ok: false, code: 'unreadable' });
    const doctype = workbook({ S: '' });
    const withDoctype = workbook({ S: '' }, '', {
      'xl/sharedStrings.xml': strToU8('<?xml version="1.0"?><!DOCTYPE sst [<!ENTITY a "aaaa">]><sst><si><t>&a;</t></si></sst>'),
    });
    expect(decodeXlsx(doctype).ok).toBe(true);
    expect(decodeXlsx(withDoctype)).toEqual({ ok: false, code: 'unreadable' });
    expect(decodeXlsx(workbook({ S: '<row r="2"/><row r="1"/>' }))).toEqual({ ok: false, code: 'unreadable' });
  });

  it('what it makes passes the schema main checks with', () => {
    const r = decodeXlsx(workbook({ S: '<row r="1"><c r="A1"><v>1</v></c></row>' }));
    expect(r.ok && DecodedDocumentSchema.safeParse(r.document).success).toBe(true);
  });
});

describe('decodePdf', () => {
  it('text items with their places: top-left origin, whitespace dropped', async () => {
    const r = await decodePdf(
      fictionalPdf([
        [
          { x: 50, y: 700, text: '01.10.2026' },
          { x: 200, y: 700, text: 'Fictional shop' },
        ],
        [{ x: 50, y: 800, text: 'Page two' }],
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || r.document.format !== 'pdf') return;
    expect(r.document.pages.map((p) => [p.width, p.height, p.items.map((i) => [i.text, i.x, i.y])])).toEqual([
      [595, 842, [['01.10.2026', 50, 142], ['Fictional shop', 200, 142]]],
      [595, 842, [['Page two', 50, 42]]],
    ]);
    expect(r.document.pages[0]?.items.every((i) => i.w > 0 && i.h > 0)).toBe(true);
    expect(DecodedDocumentSchema.safeParse(r.document).success).toBe(true);
  });

  it('limits and broken files are refused with their codes', async () => {
    const pages = Array.from({ length: DECODE_LIMITS.pages + 1 }, () => [{ x: 10, y: 10, text: 'x' }]);
    expect(await decodePdf(fictionalPdf(pages))).toEqual({ ok: false, code: 'too-many-pages' });
    expect(await decodePdf(fictionalPdf([[{ x: 10, y: 10, size: 2, text: 'y'.repeat(DECODE_LIMITS.itemChars + 1) }]]))).toEqual({ ok: false, code: 'too-long' });
    expect(await decodePdf(strToU8('%PDF-1.4\nnot really\n'))).toEqual({ ok: false, code: 'unreadable' });
  });
});

describe('the reply schema', () => {
  const sheets = { format: 'sheets', sheets: [{ name: 'S', rows: [[{ t: 's', v: 'a' }, null]] }] };
  const pdf = { format: 'pdf', pages: [{ width: 595, height: 842, items: [{ x: 1, y: 2, w: 3, h: 4, text: 'a' }] }] };

  it('takes a document or a failure code, nothing else', () => {
    expect(FromDecoder.safeParse({ type: 'document', document: sheets }).success).toBe(true);
    expect(FromDecoder.safeParse({ type: 'document', document: pdf }).success).toBe(true);
    expect(FromDecoder.safeParse({ type: 'failure', code: 'too-large' }).success).toBe(true);
    expect(FromDecoder.safeParse({ type: 'failure', code: 'boom' }).success).toBe(false);
    expect(FromDecoder.safeParse({ type: 'failure', code: 'too-large', message: 'x' }).success).toBe(false);
    expect(FromDecoder.safeParse({ type: 'document', document: { format: 'text', text: 'a' } }).success).toBe(false);
  });

  it('refuses an answer that breaks it: extra fields, other cell types, empty items, limits', () => {
    const bad = [
      { ...sheets, extra: 1 },
      { format: 'sheets', sheets: [{ name: 'S', rows: [[{ t: 'f', v: '=1' }]] }] },
      { format: 'sheets', sheets: [{ name: 'S', rows: [[{ t: 'n', v: 1 }]] }] },
      { format: 'sheets', sheets: [{ name: 'S', rows: [[{ t: 's', v: 'x'.repeat(DECODE_LIMITS.cellChars + 1) }]] }] },
      { format: 'sheets', sheets: [{ name: 'S', rows: Array.from({ length: DECODE_LIMITS.cells + 1 }, () => []) }] },
      { format: 'sheets', sheets: Array.from({ length: DECODE_LIMITS.sheets + 1 }, () => ({ name: 'S', rows: [] })) },
      { format: 'pdf', pages: [{ width: 595, height: 842, items: [{ x: 1, y: 2, w: 3, h: 4, text: '' }] }] },
      { format: 'pdf', pages: [{ width: 595, height: 842, items: [{ x: Number.NaN, y: 2, w: 3, h: 4, text: 'a' }] }] },
      { format: 'pdf', pages: [{ width: 0, height: 842, items: [] }] },
      { format: 'pdf', pages: Array.from({ length: DECODE_LIMITS.pages + 1 }, () => ({ width: 1, height: 1, items: [] })) },
      {
        format: 'pdf',
        pages: [{ width: 1, height: 1, items: Array.from({ length: DECODE_LIMITS.items + 1 }, () => ({ x: 0, y: 0, w: 1, h: 1, text: 'a' })) }],
      },
    ];
    for (const document of bad) expect(DecodedDocumentSchema.safeParse(document).success, JSON.stringify(document).slice(0, 80)).toBe(false);
  });
});

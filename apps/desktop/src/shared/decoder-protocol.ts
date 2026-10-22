// Messages between main and the statement decoder (src/decoder/process.ts), a short-lived process forked per upload:
// one `decode` in, one reply out, then it exits. A spreadsheet becomes sheets of typed cell texts, a PDF its text items
// with their places; nothing else leaves the process. Main checks the reply against these schemas, limits included,
// before any reader sees it; the decoder checks its own output the same way.
import { z } from 'zod';
import type { StatementDocument } from '@mono/core/providers/types';

/** The file kinds the decoder takes; text files are decoded in main. */
export const DECODE_FORMATS = ['xlsx', 'pdf'] as const;
export type DecodeFormat = (typeof DECODE_FORMATS)[number];

/** Larger than any real statement, and the most a crafted file can make the decoder hold or send. */
export const DECODE_LIMITS = {
  /** The file itself (main reads no more). */
  bytes: 10 * 1024 * 1024,
  /** What a workbook's archive declares its inflated parts to be, all together: a zip bomb stops here. */
  unpackedBytes: 50 * 1024 * 1024,
  sheets: 50,
  /** Cells of all sheets; an empty row counts as one. */
  cells: 200_000,
  cellChars: 1000,
  pages: 500,
  /** Text items of all pages. */
  items: 200_000,
  itemChars: 200,
} as const;

/**
 * Why a file was not decoded: not a readable workbook or PDF, a PDF behind a password, an archive that declares more
 * than `unpackedBytes`, or a limit passed (sheets, cells, pages, items, the text of one cell or item).
 */
export const DECODE_FAILURES = [
  'unreadable',
  'encrypted',
  'too-large',
  'too-many-sheets',
  'too-many-cells',
  'too-many-pages',
  'too-many-items',
  'too-long',
] as const;
export type DecodeFailure = (typeof DECODE_FAILURES)[number];

/** What the decoder makes: the binary half of core's StatementDocument. */
export type DecodedDocument = Extract<StatementDocument, { format: 'sheets' | 'pdf' }>;
export type DecodeResult = { ok: true; document: DecodedDocument } | { ok: false; code: DecodeFailure };

const finite = z.number().finite();

const cell = z.strictObject({ t: z.enum(['s', 'n', 'b']), v: z.string().max(DECODE_LIMITS.cellChars) }).nullable();

const sheets = z
  .strictObject({
    format: z.literal('sheets'),
    sheets: z.array(z.strictObject({ name: z.string().max(100), rows: z.array(z.array(cell)) })).max(DECODE_LIMITS.sheets),
  })
  .refine((d) => d.sheets.reduce((n, s) => n + s.rows.reduce((m, r) => m + Math.max(r.length, 1), 0), 0) <= DECODE_LIMITS.cells, 'too many cells');

const pdf = z
  .strictObject({
    format: z.literal('pdf'),
    pages: z
      .array(
        z.strictObject({
          width: finite.positive(),
          height: finite.positive(),
          items: z.array(z.strictObject({ x: finite, y: finite, w: finite, h: finite, text: z.string().min(1).max(DECODE_LIMITS.itemChars) })),
        }),
      )
      .max(DECODE_LIMITS.pages),
  })
  .refine((d) => d.pages.reduce((n, p) => n + p.items.length, 0) <= DECODE_LIMITS.items, 'too many items');

export const DecodedDocumentSchema = z.union([sheets, pdf]) satisfies z.ZodType<DecodedDocument>;

export const DecodeMessage = z.strictObject({
  type: z.literal('decode'),
  format: z.enum(DECODE_FORMATS),
  bytes: z.instanceof(Uint8Array).refine((b) => b.byteLength <= DECODE_LIMITS.bytes, 'too large'),
});
export type DecodeMessage = z.infer<typeof DecodeMessage>;

export const DocumentMessage = z.strictObject({ type: z.literal('document'), document: DecodedDocumentSchema });
export const DecodeFailureMessage = z.strictObject({ type: z.literal('failure'), code: z.enum(DECODE_FAILURES) });
export const FromDecoder = z.discriminatedUnion('type', [DocumentMessage, DecodeFailureMessage]);
export type FromDecoder = z.infer<typeof FromDecoder>;

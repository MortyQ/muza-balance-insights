// The spike for the statement decoder's PDF half: pdfjs-dist's legacy build reads a fictional PDF in plain Node with
// the options the decoder uses — no font faces, no system fonts, no WebAssembly, no worker thread (its handler runs in
// the same process). pdf.js 6 has no eval path at all (its `isEvalSupported` option is gone): checked below. Text items and their positions come back; nothing is rendered. pdf.js adds whitespace-only items
// between the words of a line: they carry no text and are dropped. Without the optional native canvas pdf.js warns at
// import that it cannot polyfill DOMMatrix / Path2D: rendering only, text needs neither.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fictionalPdf } from './helpers/pdf.ts';

describe('pdfjs-dist in plain Node', () => {
  it('reads the text items of a fictional PDF with their positions', async () => {
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    const { getDocument, VerbosityLevel } = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const bytes = fictionalPdf([
      [
        { x: 50, y: 780, text: 'Fictional Bank statement', size: 14 },
        { x: 50, y: 700, text: '01.10.2026 10:00' },
        { x: 200, y: 700, text: 'Fictional shop' },
        { x: 450, y: 700, text: '-100.00' },
      ],
      [{ x: 50, y: 780, text: 'Page two (fictional)' }],
    ]);
    const task = getDocument({
      data: bytes,
      disableFontFace: true,
      useSystemFonts: false,
      useWasm: false,
      verbosity: VerbosityLevel.ERRORS,
    });
    const doc = await task.promise;
    expect(doc.numPages).toBe(2);

    const page = await doc.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    expect([width, height]).toEqual([595, 842]);
    const text = await page.getTextContent();
    const items = text.items.flatMap((i) => ('str' in i && i.str.trim() !== '' ? [{ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height }] : []));
    expect(items.map((i) => [i.str, i.x, i.y])).toEqual([
      ['Fictional Bank statement', 50, 780],
      ['01.10.2026 10:00', 50, 700],
      ['Fictional shop', 200, 700],
      ['-100.00', 450, 700],
    ]);
    expect(items.every((i) => i.w > 0 && i.h > 0)).toBe(true);
    const two = await (await doc.getPage(2)).getTextContent();
    expect(two.items.flatMap((i) => ('str' in i ? [i.str] : [])).filter((s) => s.trim() !== '')).toEqual(['Page two (fictional)']);
    await task.destroy();
  });

  it.each(['pdf.mjs', 'pdf.worker.mjs'])('the legacy build %s has no new Function and no eval', (file) => {
    const dir = path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.mjs'));
    expect(fs.readFileSync(path.join(dir, file), 'utf8')).not.toMatch(/new Function\b|\beval\s*\(/);
  });
});

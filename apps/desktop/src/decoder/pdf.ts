// A PDF → its text items with their places, page by page. pdf.js's legacy build runs in this process (its worker's
// handler on the same thread, no worker thread), without font faces, system fonts or WebAssembly, and renders
// nothing; pdf.js 6 has no eval path (tests/decoder-pdf.test.ts scans it). Places are in PDF points with the origin at
// the page's top left: x to the right, y down to the text's baseline; w and h are the item's size. Whitespace-only
// items (pdf.js puts them between the words of a line) are dropped.
import type { DecodeResult } from '../shared/decoder-protocol.ts';
import { DECODE_LIMITS } from '../shared/decoder-protocol.ts';

type Page = { width: number; height: number; items: Array<{ x: number; y: number; w: number; h: number; text: string }> };

const round = (n: number) => Math.round(n * 100) / 100;

async function pdfjs() {
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

export async function decodePdf(bytes: Uint8Array): Promise<DecodeResult> {
  const { getDocument, Util, VerbosityLevel } = await pdfjs();
  const task = getDocument({
    // pdf.js takes the buffer over; the caller's bytes stay as they are.
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    enableXfa: false,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    let doc;
    try {
      doc = await task.promise;
    } catch (err) {
      return { ok: false, code: err instanceof Error && err.name === 'PasswordException' ? 'encrypted' : 'unreadable' };
    }
    if (doc.numPages > DECODE_LIMITS.pages) return { ok: false, code: 'too-many-pages' };
    const pages: Page[] = [];
    let total = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: Page['items'] = [];
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue;
        if (item.str.length > DECODE_LIMITS.itemChars) return { ok: false, code: 'too-long' };
        if (++total > DECODE_LIMITS.items) return { ok: false, code: 'too-many-items' };
        // The item's transform in the page's view: top-left origin, y down, any page rotation applied.
        const [, , , , x, y] = Util.transform(viewport.transform, item.transform) as number[];
        items.push({ x: round(x ?? 0), y: round(y ?? 0), w: round(item.width), h: round(item.height), text: item.str });
      }
      pages.push({ width: round(viewport.width), height: round(viewport.height), items });
    }
    return { ok: true, document: { format: 'pdf', pages } };
  } catch {
    return { ok: false, code: 'unreadable' };
  } finally {
    await task.destroy();
  }
}

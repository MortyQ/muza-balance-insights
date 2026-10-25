// A hand-written PDF for tests: one or more pages of plain text in Helvetica (a standard font, nothing embedded), with
// a correct cross-reference table. ASCII text only. Invented content only.

export type PdfText = { x: number; y: number; text: string; size?: number };

const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** The bytes of a PDF whose pages hold the given text items (PDF points, origin bottom-left, A4). */
export function fictionalPdf(pages: ReadonlyArray<ReadonlyArray<PdfText>>): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) - 1 + 1;
  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  add('PAGES');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const items of pages) {
    const content = items.map((t) => `BT /F1 ${t.size ?? 10} Tf ${t.x} ${t.y} Td (${escape(t.text)}) Tj ET`).join('\n');
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

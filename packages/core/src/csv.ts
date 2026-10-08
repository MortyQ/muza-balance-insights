// A CSV reader for statement files (RFC 4180): comma-separated, a field in double quotes may hold commas, line
// breaks and doubled quotes. A leading BOM is dropped; an empty last line is not a row. Banks write nothing fancier.

export class CsvError extends Error {
  override name = 'CsvError';
}

export function parseCsv(input: string): string[][] {
  const text = input.startsWith('﻿') ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      endRow();
      i++;
    } else if (ch === '\n' || ch === '\r') {
      endRow();
    } else {
      field += ch;
    }
    i++;
  }
  if (quoted) throw new CsvError('An unclosed quote');
  if (field !== '' || row.length > 0) endRow();
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

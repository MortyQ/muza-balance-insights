import type { Db } from '../db.ts';
import { currencyAlpha, formatMinor } from '@mono/core/format';
import { defaultAccountSelection } from '@mono/core/sync';

/**
 * Accounts as text lines: id, kind, type (or jar title), currency, balance, default-sync flag.
 * Only whitelisted columns are selected — iban / masked_pan never leave the DB here.
 */
export async function renderAccountsTable(db: Db): Promise<string[]> {
  const inDefault = new Set((await defaultAccountSelection(db)).selected);
  const rs = await db.execute(
    `SELECT id, kind, type, title, currency_code, balance FROM accounts ORDER BY kind = 'jar', id`,
  );
  const header = {
    id: 'id',
    kind: 'kind',
    type: 'type / банка',
    currency: 'currency',
    balance: 'balance',
    sync: 'в синке по умолчанию',
  };
  type Row = typeof header;
  const rows: Row[] = rs.rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    type: r.kind === 'jar' ? `«${String(r.title ?? '')}»` : String(r.type ?? ''),
    currency: currencyAlpha(Number(r.currency_code)),
    balance: formatMinor(Number(r.balance)),
    sync: inDefault.has(String(r.id)) ? 'да' : 'нет (--account)',
  }));
  const cols = Object.keys(header) as Array<keyof Row>;
  const width = (c: keyof Row) => Math.max(header[c].length, ...rows.map((r) => r[c].length));
  const line = (r: Row) =>
    cols.map((c) => (c === 'balance' ? r[c].padStart(width(c)) : r[c].padEnd(width(c)))).join('  ').trimEnd();
  return [line(header), ...rows.map(line)];
}

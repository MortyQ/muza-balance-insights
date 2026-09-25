// Builds the anonymized analysis copy from the real database.
// A fresh file is created and filled with whitelisted columns only: the source is never copied,
// so nothing removed by masking can survive in free pages of the output file.
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type InValue } from '@libsql/client';
import type { Db } from '../db.ts';
import { accountProviders, providerOf } from '@mono/core/connections';
import { JAR_PLACEHOLDER, OTHER_PLACEHOLDER, maskDescription, type DescClass } from '@mono/core/masking';
import { ANALYSIS_DB_PATH, ANALYSIS_SCHEMA, type AnalysisTable } from './schema.ts';

type Row = Record<string, InValue>;

export type ExportSummary = {
  path: string;
  rows: Record<AnalysisTable, number>;
  /** Every distinct exported description with its count, most frequent first. */
  descriptions: Array<{ description: string; n: number }>;
  descClasses: Record<DescClass, number>;
  otherCount: number;
};

const INSERT_CHUNK = 500;

export async function exportAnalysis(source: Db, outPath: string = ANALYSIS_DB_PATH): Promise<ExportSummary> {
  const accounts = await readAccounts(source);
  const jarTitles = new Set(accounts.jarTitles);
  const transactions = await readTransactions(source, jarTitles);
  const syncState = await readSyncState(source);

  const tables: Record<AnalysisTable, Row[]> = {
    accounts: accounts.rows,
    transactions,
    sync_state: syncState,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpPath = `${outPath}.tmp`;
  removeDbFiles(tmpPath);
  const out = createClient({ url: `file:${tmpPath}` });
  try {
    await out.execute('PRAGMA journal_mode = DELETE');
    for (const [table, columns] of Object.entries(ANALYSIS_SCHEMA) as Array<[AnalysisTable, typeof ANALYSIS_SCHEMA[AnalysisTable]]>) {
      await out.execute(`CREATE TABLE ${table} (${columns.map((c) => `${c.name} ${c.type}`).join(', ')})`);
      await insertRows(out, table, tables[table]);
    }
    await out.execute('CREATE INDEX idx_tx_account_time ON transactions (account_id, time)');
    await out.execute('CREATE INDEX idx_tx_time ON transactions (time)');
    await out.execute('CREATE INDEX idx_tx_local_date ON transactions (local_date)');
  } finally {
    out.close();
  }
  removeDbFiles(outPath);
  fs.renameSync(tmpPath, outPath);

  return summarize(outPath, tables);
}

async function readAccounts(source: Db): Promise<{ rows: Row[]; jarTitles: string[] }> {
  const rs = await source.execute(
    `SELECT a.id, c.participant_id, a.kind, a.type, a.currency_code, a.title, a.goal, a.balance, a.credit_limit, a.updated_at
     FROM accounts a JOIN connections c ON c.id = a.connection_id ORDER BY a.id`,
  );
  const jarTitles: string[] = [];
  const rows = rs.rows.map((r) => {
    const isJar = r.kind === 'jar';
    if (isJar && typeof r.title === 'string' && r.title.trim() !== '') jarTitles.push(r.title.trim());
    return {
      id: r.id,
      participant_id: r.participant_id,
      kind: r.kind,
      type: r.type,
      currency_code: r.currency_code,
      title: isJar ? JAR_PLACEHOLDER : null,
      goal: r.goal,
      balance: r.balance,
      credit_limit: r.credit_limit,
      updated_at: r.updated_at,
    } as Row;
  });
  return { rows, jarTitles };
}

async function readTransactions(source: Db, jarTitles: ReadonlySet<string>): Promise<Row[]> {
  // counter_name is reduced to a flag inside SQL: the name itself never reaches this process.
  const rs = await source.execute(
    `SELECT id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
            currency_code, commission_rate, cashback_amount, balance,
            (counter_name IS NOT NULL AND TRIM(counter_name) <> '') AS has_counter,
            category, scope, is_internal_transfer, transfer_rule, transfer_pair_id, refund_pair_id, is_cancelled, synced_at
     FROM transactions ORDER BY account_id, time, id`,
  );
  const providers = await accountProviders(source);
  return rs.rows.map((r) => {
    const masked = maskDescription(String(r.description ?? ''), jarTitles, providerOf(providers, String(r.account_id)));
    return {
      id: r.id,
      account_id: r.account_id,
      time: r.time,
      local_date: r.local_date,
      description: masked.description,
      desc_class: masked.descClass,
      mcc: r.mcc,
      original_mcc: r.original_mcc,
      hold: r.hold,
      amount: r.amount,
      operation_amount: r.operation_amount,
      currency_code: r.currency_code,
      commission_rate: r.commission_rate,
      cashback_amount: r.cashback_amount,
      balance: r.balance,
      has_counter: Number(r.has_counter) === 1 ? 1 : 0,
      category: r.category,
      scope: r.scope,
      is_internal_transfer: r.is_internal_transfer,
      transfer_rule: r.transfer_rule,
      transfer_pair_id: r.transfer_pair_id,
      refund_pair_id: r.refund_pair_id,
      is_cancelled: r.is_cancelled,
      synced_at: r.synced_at,
    } as Row;
  });
}

async function readSyncState(source: Db): Promise<Row[]> {
  const rs = await source.execute(
    `SELECT account_id, oldest_synced_time, newest_synced_time, last_sync_at FROM sync_state ORDER BY account_id`,
  );
  return rs.rows.map((r) => ({
    account_id: r.account_id,
    oldest_synced_time: r.oldest_synced_time,
    newest_synced_time: r.newest_synced_time,
    last_sync_at: r.last_sync_at,
  }) as Row);
}

async function insertRows(out: ReturnType<typeof createClient>, table: AnalysisTable, rows: Row[]): Promise<void> {
  const columns: string[] = ANALYSIS_SCHEMA[table].map((c) => c.name);
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    await out.batch(
      chunk.map((row) => {
        const extra = Object.keys(row).filter((k) => !columns.includes(k));
        if (extra.length > 0) throw new Error(`${table}: колонки вне whitelist: ${extra.join(', ')}`);
        return { sql, args: columns.map((c) => row[c] ?? null) };
      }),
      'write',
    );
  }
}

function removeDbFiles(dbPath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
}

function summarize(outPath: string, tables: Record<AnalysisTable, Row[]>): ExportSummary {
  const counts = new Map<string, number>();
  const descClasses: Record<DescClass, number> = { service: 0, card_pan: 0, from_prefix: 0, treasury: 0, other: 0 };
  for (const tx of tables.transactions) {
    const d = String(tx.description);
    counts.set(d, (counts.get(d) ?? 0) + 1);
    descClasses[tx.desc_class as DescClass] += 1;
  }
  return {
    path: outPath,
    rows: {
      accounts: tables.accounts.length,
      transactions: tables.transactions.length,
      sync_state: tables.sync_state.length,
    },
    descriptions: [...counts]
      .map(([description, n]) => ({ description, n }))
      .sort((a, b) => b.n - a.n || a.description.localeCompare(b.description)),
    descClasses,
    otherCount: counts.get(OTHER_PLACEHOLDER) ?? 0,
  };
}

/** Human-readable report for the CLI: row counts and every distinct description (to eyeball the masking). */
/** `descriptions: false` leaves out the list of masked descriptions (recategorize prints counts only). */
export function formatExportSummary(s: ExportSummary, opts: { descriptions?: boolean } = {}): string[] {
  const lines = [
    `Обезличенная копия: ${s.path}`,
    `Строк: accounts ${s.rows.accounts}, transactions ${s.rows.transactions}, sync_state ${s.rows.sync_state}`,
    `desc_class: ${Object.entries(s.descClasses).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `Замаскировано в '${OTHER_PLACEHOLDER}': ${s.otherCount}`,
  ];
  if (opts.descriptions === false) return lines;
  lines.push('Уникальные description (проверь, что здесь нет имён и номеров):');
  for (const d of s.descriptions) lines.push(`  ${String(d.n).padStart(6)}  ${d.description}`);
  return lines;
}

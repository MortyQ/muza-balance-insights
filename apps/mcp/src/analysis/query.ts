// Read-only SQL over the anonymized analysis copy (pnpm q). Defense in depth only:
// the real boundary is the OS sandbox, which denies reading data/ regardless of this code.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'libsql';
import { REPO_ROOT } from '../paths.ts';
import { ANALYSIS_DB_PATH } from './schema.ts';

export const MAX_ROWS = 500;

/** The only folder q reads SQL from (gitignored with the rest of analysis/). */
export const QUERIES_DIR = path.join(REPO_ROOT, 'analysis', 'queries');

const MAX_QUERY_BYTES = 64 * 1024;

export class QueryRejected extends Error {
  override name = 'QueryRejected';
}

export type QueryResult = {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
};

/**
 * Splits SQL into statements on `;` outside strings, quoted identifiers and comments,
 * and returns the non-empty ones with comments removed.
 * libsql's prepare() silently ignores everything after the first statement, so this is the only
 * thing that catches "SELECT 1; DROP TABLE t".
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i] as string;
    const next = sql[i + 1];
    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      current += ' ';
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) throw new QueryRejected('Незакрытый комментарий /* … */');
      i = end + 2;
      current += ' ';
      continue;
    }
    const close = ch === "'" ? "'" : ch === '"' ? '"' : ch === '`' ? '`' : ch === '[' ? ']' : null;
    if (close) {
      let j = i + 1;
      for (;;) {
        const end = sql.indexOf(close, j);
        if (end === -1) throw new QueryRejected('Незакрытая строка или идентификатор');
        // '' / "" / `` inside a quoted token is an escaped quote; [] has no escape.
        if (close !== ']' && sql[end + 1] === close) {
          j = end + 2;
          continue;
        }
        current += sql.slice(i, end + 1);
        i = end + 1;
        break;
      }
      continue;
    }
    if (ch === ';') {
      statements.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  statements.push(current);
  return statements.map((s) => s.trim()).filter((s) => s !== '');
}

/** Returns the single statement to run, or throws QueryRejected. */
export function validateQuery(sql: string): string {
  const statements = splitStatements(sql);
  if (statements.length === 0) throw new QueryRejected('Пустой запрос');
  if (statements.length > 1) throw new QueryRejected('Разрешён ровно один statement');
  const statement = statements[0] as string;
  const keyword = /^[A-Za-z]+/.exec(statement)?.[0]?.toUpperCase();
  if (keyword !== 'SELECT' && keyword !== 'WITH') {
    throw new QueryRejected(`Разрешены только SELECT и WITH, получено: ${keyword ?? '(не SQL)'}`);
  }
  return statement;
}

/**
 * Reads the SQL of `pnpm q <file>`. `file` is relative to the repository root (or absolute) and must be a .sql file
 * inside analysis/queries/ — also after resolving symlinks, so a link can't point q at another file.
 * `queriesDir` exists for tests; the CLI never passes it.
 */
export function readQueryFile(file: string, queriesDir: string = QUERIES_DIR, root: string = REPO_ROOT): string {
  const inside = (dir: string, p: string) => {
    const rel = path.relative(dir, p);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  const where = 'analysis/queries/<имя>.sql';
  const resolved = path.resolve(root, file);
  if (path.extname(resolved) !== '.sql') throw new QueryRejected(`Нужен файл .sql в ${where}`);
  if (!inside(queriesDir, resolved)) throw new QueryRejected(`Файл запроса должен лежать в ${where}`);
  let real: string;
  try {
    real = fs.realpathSync(resolved);
  } catch {
    throw new QueryRejected(`Файл не найден: ${path.relative(root, resolved)}`);
  }
  if (!inside(fs.realpathSync(queriesDir), real)) throw new QueryRejected(`Файл запроса должен лежать в ${where} (без ссылок наружу)`);
  const stat = fs.statSync(real);
  if (!stat.isFile()) throw new QueryRejected('Это не файл');
  if (stat.size > MAX_QUERY_BYTES) throw new QueryRejected(`Файл запроса больше ${MAX_QUERY_BYTES / 1024} КБ`);
  return fs.readFileSync(real, 'utf8');
}

/** Runs one read-only query. `dbPath` exists for tests; the CLI never passes it. */
export function runQuery(sql: string, dbPath: string = ANALYSIS_DB_PATH, maxRows: number = MAX_ROWS): QueryResult {
  const statement = validateQuery(sql);
  if (!fs.existsSync(dbPath)) {
    throw new QueryRejected(`Нет ${dbPath}. Пользователь должен сначала выполнить pnpm --filter @mono/mcp export:analysis`);
  }
  const db = new Database(`file:${dbPath}?mode=ro`);
  try {
    db.exec('PRAGMA query_only = ON');
    const stmt = db.prepare(statement);
    // WITH … DELETE passes the keyword check; a statement that returns no rows is not a query.
    if (!stmt.reader) throw new QueryRejected('Запрос не возвращает строки (запись запрещена)');
    const columns = stmt.columns().map((c) => c.name);
    const rows: unknown[][] = [];
    let truncated = false;
    for (const row of stmt.raw().iterate() as Iterable<unknown[]>) {
      if (rows.length === maxRows) {
        truncated = true;
        break;
      }
      rows.push(row);
    }
    return { columns, rows, truncated };
  } finally {
    db.close();
  }
}

/** Plain aligned table; NULL is printed as NULL. */
export function formatResult(r: QueryResult): string {
  const cell = (v: unknown) => (v === null || v === undefined ? 'NULL' : String(v));
  const cells = r.rows.map((row) => row.map(cell));
  const widths = r.columns.map((c, i) => Math.max(c.length, ...cells.map((row) => (row[i] ?? '').length)));
  const line = (values: string[]) => values.map((v, i) => v.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  const out = [line(r.columns), line(widths.map((w) => '-'.repeat(w))), ...cells.map(line)];
  out.push(r.truncated ? `(показаны первые ${r.rows.length} строк, результат обрезан)` : `(${r.rows.length} строк)`);
  return out.join('\n');
}

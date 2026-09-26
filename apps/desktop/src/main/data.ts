// Read side of the screen in main: the same core aggregates as the MCP tools (spendingSummary, getBalances), mapped
// to the narrow view types of src/shared/api.ts. Only categories, amounts, dates and «black/UAH» labels leave main —
// never names, descriptions, card numbers or IBANs. The import worker writes the same file; WAL lets both work.
import { ensureDefaultConnection } from '@mono/core/connections';
import { migrate, type Db } from '@mono/core/db';
import { listConnections } from '@mono/core/participants';
import type { ProviderId } from '@mono/core/providers/types';
import { toKyivDateTime } from '@mono/core/format';
import { getBalances } from '@mono/core/status';
import { spendingSummary } from '@mono/core/summaries';
import type { BalanceLine, BalancesView, DataStatus, SpendingQuery, SpendingView } from '../shared/api.ts';

export type DataServiceDeps = {
  open: () => Promise<Db>;
  nowSec: () => number;
};

export class DataService {
  private db: Promise<Db> | null = null;

  constructor(private readonly d: DataServiceDeps) {}

  private conn(): Promise<Db> {
    if (this.db) return this.db;
    const opening = this.d.open().then(async (db) => {
      try {
        await migrate(db, this.d.nowSec());
      } catch (err) {
        db.close();
        throw err;
      }
      return db;
    });
    this.db = opening;
    // A failed open is not cached: the next call tries again.
    opening.catch(() => {
      if (this.db === opening) this.db = null;
    });
    return opening;
  }

  async spending(q: SpendingQuery): Promise<SpendingView> {
    const s = await spendingSummary(await this.conn(), { from: q.from, to: q.to, groupBy: 'category', ...(q.scope ? { scope: q.scope } : {}) }, this.d.nowSec());
    const { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds } = s.period;
    return {
      period: { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds },
      currencies: s.totals.map((t) => ({
        currency: t.currency,
        categories: s.groups
          .filter((g) => g.currency === t.currency)
          .map((g) => ({ category: g.key, gross: g.gross, refunds: g.refunds, net: g.net }))
          .sort((a, b) => b.net - a.net || (a.category < b.category ? -1 : 1)),
        total: { category: '', gross: t.gross, refunds: t.refunds, net: t.net, netPerDay: t.netPerDay },
      })),
    };
  }

  async balances(): Promise<BalancesView> {
    const b = await getBalances(await this.conn());
    const line = (a: (typeof b.accounts)[number]): BalanceLine => ({
      id: a.id,
      label: a.label,
      currency: a.currency,
      ownFunds: a.own_funds,
      creditLimit: a.credit_limit,
      updatedAt: a.updated_at,
    });
    return {
      cards: b.accounts.filter((a) => a.kind === 'card').map(line),
      jars: b.accounts.filter((a) => a.kind === 'jar').map(line),
      totals: b.totals.map((t) => ({ currency: t.currency, ownFunds: t.own_funds })),
    };
  }

  async status(): Promise<DataStatus> {
    const rs = await (await this.conn()).execute(
      'SELECT COUNT(*) AS n, MIN(newest_synced_time) AS newest, MAX(last_sync_at) AS last FROM sync_state WHERE newest_synced_time IS NOT NULL',
    );
    const r = rs.rows[0];
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const newest = num(r?.newest);
    const last = num(r?.last);
    return {
      hasData: Number(r?.n ?? 0) > 0,
      dataUntil: newest === null ? null : toKyivDateTime(newest),
      lastSyncAt: last === null ? null : toKyivDateTime(last),
    };
  }

  /** Every connection (the import takes them all). */
  async connections(): Promise<Array<{ connectionId: number; provider: ProviderId }>> {
    return (await listConnections(await this.conn())).map((c) => ({ connectionId: c.id, provider: c.provider }));
  }

  /**
   * The only Monobank connection, while the token IPC knows one connection (until step 4d): created with its
   * participant on `create`, otherwise null when there is none yet.
   */
  async monobankConnection(create: boolean): Promise<number | null> {
    const db = await this.conn();
    if (create) return ensureDefaultConnection(db, 'monobank', this.d.nowSec());
    const rs = await db.execute(`SELECT id FROM connections WHERE provider = 'monobank' ORDER BY id LIMIT 1`);
    return rs.rows[0] ? Number(rs.rows[0].id) : null;
  }

  /** Closes the connection (before the files are deleted). The next call opens a fresh database. */
  async close(): Promise<void> {
    const db = this.db;
    this.db = null;
    if (!db) return;
    try {
      (await db).close();
    } catch {
      // Never opened: nothing to close.
    }
  }
}

// Whitelist of everything that may leave data/monobank.db for the analysis copy.
// A column not listed here is never exported, even if it is added to the source schema later.
import path from 'node:path';
import { REPO_ROOT } from '../paths.ts';

/** The only file the analysis tools read or write. Fixed in code on purpose. */
export const ANALYSIS_DB_PATH = path.join(REPO_ROOT, 'analysis', 'analysis.sqlite');

export type ColumnSpec = { readonly name: string; readonly type: string };

export const ANALYSIS_SCHEMA = {
  accounts: [
    { name: 'id', type: 'TEXT' },
    { name: 'participant_id', type: 'INTEGER' }, // whose account (a number; the participant's label never leaves the db)
    { name: 'kind', type: 'TEXT' },
    { name: 'type', type: 'TEXT' },
    { name: 'currency_code', type: 'INTEGER' },
    { name: 'title', type: 'TEXT' }, // '[jar]' for jars, NULL for cards
    { name: 'goal', type: 'INTEGER' },
    { name: 'balance', type: 'INTEGER' },
    { name: 'credit_limit', type: 'INTEGER' },
    { name: 'updated_at', type: 'INTEGER' },
  ],
  transactions: [
    { name: 'id', type: 'TEXT' },
    { name: 'account_id', type: 'TEXT' },
    { name: 'time', type: 'INTEGER' },
    { name: 'local_date', type: 'TEXT' },
    { name: 'description', type: 'TEXT' }, // masked, see src/masking.ts
    { name: 'desc_class', type: 'TEXT' }, // derived from the raw description's shape
    { name: 'mcc', type: 'INTEGER' },
    { name: 'original_mcc', type: 'INTEGER' },
    { name: 'hold', type: 'INTEGER' },
    { name: 'amount', type: 'INTEGER' },
    { name: 'operation_amount', type: 'INTEGER' },
    { name: 'currency_code', type: 'INTEGER' },
    { name: 'commission_rate', type: 'INTEGER' },
    { name: 'cashback_amount', type: 'INTEGER' },
    { name: 'balance', type: 'INTEGER' },
    { name: 'has_counter', type: 'INTEGER' }, // counter_name IS NOT NULL; the name itself is never read
    { name: 'category', type: 'TEXT' },
    { name: 'scope', type: 'TEXT' }, // personal | business (src/scope.ts)
    { name: 'is_internal_transfer', type: 'INTEGER' },
    { name: 'transfer_rule', type: 'TEXT' }, // pair / pair_fx / pair_fee / jar_reversal / iban / text / family
    { name: 'transfer_pair_id', type: 'TEXT' }, // id of the other half (a transaction id, not a counterparty)
    { name: 'refund_pair_id', type: 'TEXT' }, // purchase ↔ refund with a different MCC (transaction ids)
    { name: 'is_cancelled', type: 'INTEGER' },
    { name: 'synced_at', type: 'INTEGER' },
  ],
  sync_state: [
    { name: 'account_id', type: 'TEXT' },
    { name: 'oldest_synced_time', type: 'INTEGER' },
    { name: 'newest_synced_time', type: 'INTEGER' },
    { name: 'last_sync_at', type: 'INTEGER' },
  ],
} as const satisfies Record<string, readonly ColumnSpec[]>;

export type AnalysisTable = keyof typeof ANALYSIS_SCHEMA;

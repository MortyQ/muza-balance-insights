// Import state as the renderer sees it (main → renderer over PROGRESS_CHANNEL). Plain types, no dependencies.
// Nothing here can carry a token, a description or a counterparty: accounts appear by their name parts (AccountName).

import type { AccountName } from './account-name.ts';

export type WindowProgress = {
  phase: 'windows';
  /** Never a card number or a jar title; null before the accounts are known. */
  account: AccountName | null;
  /** Window dates, Kyiv, YYYY-MM-DD. */
  from: string;
  to: string;
  /** Round-robin round (1 = the freshest window of every account). */
  round: number;
  /** Position within the account. */
  index: number;
  total: number;
  windowsDone: number;
  windowsTotal: number;
  transactions: number;
  /** Rough: remaining windows × 60 s (Monobank's limit) + the current wait; more if a window has > 500 items. */
  etaSec: number;
  /** Seconds left of the current rate-limit wait, or null. */
  waitingSec: number | null;
};

/**
 * Why a connection or the whole import stopped; the renderer words it (`home.import.error.*`). The worker's codes:
 * auth = the bank rejected the token; other-holder / already-connected = the token is of another bank account / that
 * account is in another connection; bank = any other bank error; db-open = the worker could not open the database.
 */
export const WORKER_ERRORS = ['auth', 'other-holder', 'already-connected', 'rate-limit', 'network', 'format', 'bank', 'other', 'db-open'] as const;
/** Main's own: no-token = the token was only in memory (a resumed import); crash = the worker kept dying for hours. */
export type ImportError = (typeof WORKER_ERRORS)[number] | 'no-token' | 'crash';

export type ImportFailure = { connectionId: number; error: ImportError };

export type RetryReason = 'network' | 'server' | 'rate-limit' | 'crash';

export type ImportProgress = (
  | { phase: 'idle' }
  /** An unfinished import exists but these connections' tokens were only in memory: the UI asks for them. */
  | { phase: 'needs-token'; connectionIds: number[] }
  | { phase: 'starting'; resumed: boolean }
  | { phase: 'accounts' }
  | WindowProgress
  /** A failure the import waits out: network / Monobank 5xx / repeated 429 (worker), or a crashed worker (main). */
  | { phase: 'retry'; reason: RetryReason; attempt: number; inSec: number }
  | { phase: 'rederive' }
  /** `failed`: connections that did not import (a rejected or missing token …); the others did. */
  | { phase: 'done'; windowsTotal: number; transactions: number; failed: ImportFailure[] }
  | { phase: 'cancelled' }
  | { phase: 'error'; error: ImportError }
) & {
  /** Started by «Автосинхронизация», not by the user: the UI shows it quietly. On every state of that run. */
  auto?: true;
};

/** `db-unavailable`: the database key is not readable right now (DbAccess not ready) — nothing to import into. */
export type StartImportResult = { started: true } | { started: false; reason: 'running' | 'no-token' | 'db-unavailable' };

/** True while a job is actually in flight (worker work or a scheduled retry) — the lock screen's «Идёт импорт» flag.
 *  Exhaustive over ImportProgress['phase'] so a new phase must be classified here, not left to fall through. */
export function importActive(p: ImportProgress): boolean {
  switch (p.phase) {
    case 'starting':
    case 'accounts':
    case 'windows':
    case 'retry':
    case 'rederive':
      return true;
    case 'idle':
    case 'needs-token':
    case 'done':
    case 'cancelled':
    case 'error':
      return false;
  }
}

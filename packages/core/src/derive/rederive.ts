// Re-derives everything computed from the stored rows: internal transfers, refunds, categories, scope, crossing.
// Its report goes to the agent via recategorize (apps/mcp/src/cli/recategorize.ts, run OUTSIDE the OS sandbox):
// aggregates and diagnostics only — no descriptions, counterparties, comments, IBANs or card numbers
// (apps/mcp/tests/recategorize-safety.test.ts). Change what it prints only after the user's ok.
import { recategorize } from './categories.ts';
import type { Db } from '../storage/db.ts';
import { refreshCrossing, rederiveCrossing } from './derived.ts';
import { categoryCounts, transferDiagnostics } from './diagnostics.ts';
import { markRefunds } from './refunds.ts';
import { rescope, scopeCounts } from './scope.ts';
import { markInternalTransfers, type TimeRange } from './transfers.ts';

export async function rederiveCore(db: Db): Promise<string[]> {
  await markInternalTransfers(db);
  await markRefunds(db);
  const changed = await recategorize(db);
  await rescope(db);
  // Crossing to disabled accounts reads the transfer marks just made; nothing of it goes into the report.
  await rederiveCrossing(db);

  const d = await transferDiagnostics(db);
  const report = [
    `Категории пересчитаны, изменено строк: ${changed}`,
    `Переводы по правилам: ${Object.entries(d.byRule).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `Служебных 4829 без пары: ${d.unpairedService4829}`,
    `Возвратов, спаренных с покупкой (refund_pair): ${d.refundPairs}`,
    `Scope (строк): ${Object.entries(await scopeCounts(db)).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    'Категории (строк):',
  ];
  for (const c of await categoryCounts(db)) report.push(`  ${String(c.n).padStart(6)}  ${c.category}`);
  return report;
}

/** Spans that overlap or touch merged into one, oldest first. */
export function mergeSpans(spans: readonly TimeRange[]): TimeRange[] {
  const out: TimeRange[] = [];
  for (const s of [...spans].sort((a, b) => a.from - b.from || a.to - b.to)) {
    const last = out.at(-1);
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

/**
 * The derivation passes around one span (a committed window, or a merged span at the end of an import): transfers and
 * refunds look around it for partners, then categories, scope and crossing run over everything they touched. Returns
 * that span and how many categories changed. Throws on a failure: the caller decides what repairs it.
 */
export async function deriveSpan(db: Db, w: TimeRange): Promise<{ span: TimeRange; changed: number }> {
  const spans = [w, await markInternalTransfers(db, w), await markRefunds(db, w)].filter((r): r is TimeRange => r !== null);
  const span = { from: Math.min(...spans.map((r) => r.from)), to: Math.max(...spans.map((r) => r.to)) };
  const changed = await recategorize(db, span);
  await rescope(db, span);
  // A first coverage row can flip a jar's auto rule, and a statement can create a card: refresh decides full or span.
  await refreshCrossing(db, span);
  return { span, changed };
}

/**
 * The end of an import whose windows all derived and whose accounts did not change what old rows depend on
 * (accountInputsChanged in derived.ts): only the
 * spans the import touched, merged, each through deriveSpan. Prints nothing; a full pass is rederiveCore.
 */
export async function rederiveSpans(db: Db, spans: readonly TimeRange[]): Promise<{ spans: number; changed: number }> {
  const merged = mergeSpans(spans);
  let changed = 0;
  for (const s of merged) changed += (await deriveSpan(db, s)).changed;
  return { spans: merged.length, changed };
}


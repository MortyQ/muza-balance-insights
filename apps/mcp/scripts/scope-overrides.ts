// Scope overrides by counter_name. Run by the user only: output contains real counterparty names.
//   pnpm --filter @mono/mcp scope-overrides:candidates [<limit>]
//   pnpm --filter @mono/mcp scope-overrides:add "<pattern>" personal|business [exact|contains]
//   pnpm --filter @mono/mcp scope-overrides:list
//   pnpm --filter @mono/mcp scope-overrides:remove <id>
// add / remove re-scope all rows and refresh the analysis copy.
import { cliArgs } from '../src/args.ts';
import { refreshAnalysisCopy } from '../src/analysis/refresh.ts';
import { loadConfig } from '../src/config.ts';
import { openDb, type Db } from '../src/db.ts';
import {
  SCOPES,
  ScopeOverrideError,
  addScopeOverride,
  listScopeOverrides,
  removeScopeOverride,
  scopeOverrideCandidates,
  type MatchType,
} from '@mono/core/scope';

const USAGE = [
  'pnpm --filter @mono/mcp scope-overrides:candidates [<limit>]',
  `pnpm --filter @mono/mcp scope-overrides:add "<pattern>" ${SCOPES.join('|')} [exact|contains]`,
  'pnpm --filter @mono/mcp scope-overrides:list',
  'pnpm --filter @mono/mcp scope-overrides:remove <id>',
].join('\n');

const out = (line: string) => process.stdout.write(`${line}\n`);

function money(minor: number, currency: number): string {
  const sign = currency === 980 ? '₴' : currency === 840 ? '$' : currency === 978 ? '€' : String(currency);
  return `${Math.round(minor / 100).toLocaleString('ru-RU').replace(/ /g, ' ')} ${sign}`;
}

async function afterChange(db: Db, changedRows: number): Promise<void> {
  out(`Scope пересчитан, изменено строк: ${changedRows}`);
  await refreshAnalysisCopy(db); // report goes to stderr
}

async function main(): Promise<void> {
  // The subcommand is part of the package.json script; a literal `--` from pnpm lands after it.
  const [command, ...rest] = process.argv.slice(2);
  const args = cliArgs(rest);
  const db = await openDb(loadConfig().dbUrl);
  try {
    switch (command) {
      case 'candidates': {
        const limit = args[0] ? Number(args[0]) : 30;
        if (!Number.isInteger(limit) || limit <= 0) throw new ScopeOverrideError(`Лимит — целое число > 0: «${args[0]}»`);
        out('Кандидаты: списания с не-ФОП карт — business (казначейство) или «налоги и госплатежи», по сумме за всю историю');
        out('Шаблон сопоставляется с контрагентом, а если его нет — с описанием (последняя колонка).');
        for (const r of await scopeOverrideCandidates(db, limit)) {
          out(
            `${money(r.total, r.currency).padStart(12)}  ${String(r.rows).padStart(4)} стр.  до ${r.lastDate}  ` +
              `${(r.accountType ?? 'банка').padEnd(6)} ${r.scope.padEnd(8)}  ${r.key}`,
          );
        }
        break;
      }
      case 'add': {
        const [pattern, scope, matchType] = args;
        if (!pattern || !scope) throw new ScopeOverrideError(USAGE);
        const r = await addScopeOverride(db, pattern, scope, (matchType ?? 'exact') as MatchType);
        out(`Scope-оверрайд #${r.id}: «${pattern.trim()}» (${matchType ?? 'exact'}) → ${scope}`);
        await afterChange(db, r.changedRows);
        break;
      }
      case 'list': {
        const rows = await listScopeOverrides(db);
        if (rows.length === 0) out('Scope-оверрайдов нет');
        for (const r of rows) out(`#${r.id}  ${r.matchType.padEnd(8)}  «${r.pattern}» → ${r.scope}`);
        break;
      }
      case 'remove': {
        const id = Number(args[0]);
        if (!Number.isInteger(id)) throw new ScopeOverrideError(USAGE);
        const r = await removeScopeOverride(db, id);
        out(`Scope-оверрайд #${id} удалён`);
        await afterChange(db, r.changedRows);
        break;
      }
      default:
        throw new ScopeOverrideError(USAGE);
    }
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : 'Неизвестная ошибка'}\n`);
  process.exitCode = 1;
});

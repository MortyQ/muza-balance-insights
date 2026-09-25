// Category overrides by counter_name. Run by the user only: output contains real counterparty names.
//   pnpm --filter @mono/mcp overrides:candidates [<limit>]
//   pnpm --filter @mono/mcp overrides:add "<pattern>" <category> [exact|contains]
//   pnpm --filter @mono/mcp overrides:list
//   pnpm --filter @mono/mcp overrides:remove <id>
// add / remove re-categorize all rows and refresh the analysis copy.
import { cliArgs } from '../src/args.ts';
import { refreshAnalysisCopy } from '../src/analysis/refresh.ts';
import { loadConfig } from '../src/config.ts';
import { openDb, type Db } from '../src/db.ts';
import {
  OVERRIDE_CATEGORIES,
  OverrideError,
  addOverride,
  listOverrides,
  overrideCandidates,
  removeOverride,
  type MatchType,
} from '@mono/core/overrides';

const USAGE = [
  'pnpm --filter @mono/mcp overrides:candidates [<limit>]',
  'pnpm --filter @mono/mcp overrides:add "<pattern>" <category> [exact|contains]',
  'pnpm --filter @mono/mcp overrides:list',
  'pnpm --filter @mono/mcp overrides:remove <id>',
  `Категории: ${OVERRIDE_CATEGORIES.join(', ')}`,
].join('\n');

const out = (line: string) => process.stdout.write(`${line}\n`);

function money(minor: number, currency: number): string {
  const sign = currency === 980 ? '₴' : currency === 840 ? '$' : currency === 978 ? '€' : String(currency);
  return `${Math.round(minor / 100).toLocaleString('ru-RU').replace(/ /g, ' ')} ${sign}`;
}

async function afterChange(db: Db, changedRows: number): Promise<void> {
  out(`Категории пересчитаны, изменено строк: ${changedRows}`);
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
        if (!Number.isInteger(limit) || limit <= 0) throw new OverrideError(`Лимит — целое число > 0: «${args[0]}»`);
        const rows = await overrideCandidates(db, limit);
        out('Кандидаты в оверрайды: «переводы людям», по сумме за всю историю');
        for (const r of rows) {
          out(`${money(r.total, r.currency).padStart(12)}  ${String(r.rows).padStart(4)} стр.  до ${r.lastDate}  ${r.counterName}`);
        }
        break;
      }
      case 'add': {
        const [pattern, category, matchType] = args;
        if (!pattern || !category) throw new OverrideError(USAGE);
        const r = await addOverride(db, pattern, category, (matchType ?? 'exact') as MatchType);
        out(`Оверрайд #${r.id}: «${pattern.trim()}» (${matchType ?? 'exact'}) → ${category}`);
        await afterChange(db, r.changedRows);
        break;
      }
      case 'list': {
        const rows = await listOverrides(db);
        if (rows.length === 0) out('Оверрайдов нет');
        for (const r of rows) out(`#${r.id}  ${r.matchType.padEnd(8)}  «${r.pattern}» → ${r.category}`);
        break;
      }
      case 'remove': {
        const id = Number(args[0]);
        if (!Number.isInteger(id)) throw new OverrideError(USAGE);
        const r = await removeOverride(db, id);
        out(`Оверрайд #${id} удалён`);
        await afterChange(db, r.changedRows);
        break;
      }
      default:
        throw new OverrideError(USAGE);
    }
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : 'Неизвестная ошибка'}\n`);
  process.exitCode = 1;
});

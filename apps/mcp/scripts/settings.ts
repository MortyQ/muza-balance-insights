// User settings. Run by the user only.
//   pnpm --filter @mono/mcp settings:list
//   pnpm --filter @mono/mcp settings:set <key> on|off
// Changing treasury_business re-scopes all rows and refreshes the analysis copy.
import { cliArgs } from '../src/args.ts';
import { refreshAnalysisCopy } from '../src/analysis/refresh.ts';
import { loadConfig } from '../src/config.ts';
import { openDb } from '../src/db.ts';
import { rescope } from '@mono/core/scope';
import { SETTING_DEFAULTS, SETTING_KEYS, SettingsError, getSettings, setSetting } from '@mono/core/settings';

const USAGE = ['pnpm --filter @mono/mcp settings:list', `pnpm --filter @mono/mcp settings:set <${SETTING_KEYS.join('|')}> on|off`].join('\n');

const out = (line: string) => process.stdout.write(`${line}\n`);
const onOff = (v: boolean) => (v ? 'on' : 'off');

async function main(): Promise<void> {
  // The subcommand is part of the package.json script; a literal `--` from pnpm lands after it.
  const [command, ...rest] = process.argv.slice(2);
  const args = cliArgs(rest);
  const db = await openDb(loadConfig().dbUrl);
  try {
    switch (command) {
      case 'list': {
        const s = await getSettings(db);
        for (const key of SETTING_KEYS) {
          out(`${key.padEnd(20)} ${onOff(s[key]).padEnd(4)}${s[key] === SETTING_DEFAULTS[key] ? ' (по умолчанию)' : ''}`);
        }
        break;
      }
      case 'set': {
        const [key, value] = args;
        if (!key || !value) throw new SettingsError(USAGE);
        const r = await setSetting(db, key, value);
        out(`${r.key} = ${onOff(r.value)}`);
        if (r.key === 'treasury_business') {
          out(`Scope пересчитан, изменено строк: ${await rescope(db)}`);
          await refreshAnalysisCopy(db); // report goes to stderr
        }
        break;
      }
      default:
        throw new SettingsError(USAGE);
    }
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : 'Неизвестная ошибка'}\n`);
  process.exitCode = 1;
});

// Read-only SQL over analysis/analysis.sqlite: pnpm q analysis/queries/<name>.sql
// The SQL comes from a file, never from the command line: no SQL in the command → no false matches
// against the deny rules in .claude/settings.json. The database path is fixed in code.
import { cliArgs } from '../src/args.ts';
import { QueryRejected, formatResult, readQueryFile, runQuery } from '../src/analysis/query.ts';

const args = cliArgs();
if (args.length !== 1) {
  process.stderr.write('Использование: pnpm q analysis/queries/<имя>.sql\n');
  process.exitCode = 1;
} else {
  try {
    process.stdout.write(`${formatResult(runQuery(readQueryFile(args[0]!)))}\n`);
  } catch (err) {
    const prefix = err instanceof QueryRejected ? 'Отклонено' : 'Ошибка';
    process.stderr.write(`${prefix}: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}

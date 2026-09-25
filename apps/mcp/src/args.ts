/**
 * Arguments of a CLI entry point. `pnpm run <script> -- a b` may hand the `--` to the script literally
 * (npm strips it); drop one leading `--` so both forms mean the same (tests/cli-args.test.ts).
 */
export function cliArgs(argv: readonly string[] = process.argv.slice(2)): string[] {
  return argv[0] === '--' ? argv.slice(1) : [...argv];
}

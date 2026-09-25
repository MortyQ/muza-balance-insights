// Prints the raw CLI arguments as pnpm delivers them — for tests/cli-args.test.ts. Reads nothing else.
process.stdout.write(`ARGV ${JSON.stringify(process.argv.slice(2))}\n`);

/**
 * stderr-only logger. stdout belongs to the MCP stdio protocol — never write there.
 */
function write(level: string, msg: string): void {
  process.stderr.write(`[${new Date().toISOString()}] ${level} ${msg}\n`);
}

export const log = {
  info: (msg: string) => write('INFO', msg),
  warn: (msg: string) => write('WARN', msg),
  error: (msg: string) => write('ERROR', msg),
  /** Unprefixed line (CLI tables). Still stderr. */
  plain: (msg: string) => process.stderr.write(`${msg}\n`),
};

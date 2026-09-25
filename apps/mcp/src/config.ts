import path from 'node:path';
import { z } from 'zod';
import { REPO_ROOT, resolveDbPath } from './paths.ts';

export { REPO_ROOT };

export { RESYNC_OVERLAP_SEC, TIMEZONE } from '@mono/core/constants';
export { MAX_STATEMENT_WINDOW_SEC, RATE_LIMIT_MS, STATEMENT_PAGE_LIMIT } from '@mono/core/providers/monobank/constants';

const EnvSchema = z.object({
  MONO_TOKEN: z.string().trim().min(1).optional(),
  MONO_DB_PATH: z.string().trim().min(1).optional(),
});

export type AppConfig = {
  dbPath: string;
  dbUrl: string;
  /** Present only if MONO_TOKEN is set. Use getToken() where it is required. */
  hasToken: boolean;
};

export class ConfigError extends Error {
  override name = 'ConfigError';
}

let envLoaded = false;

/** Loads <repo>/.env once, if it exists. Real environment variables take precedence. */
function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  try {
    process.loadEnvFile(path.join(REPO_ROOT, '.env'));
  } catch (err) {
    // No .env file is fine — variables may come from the MCP client config.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new ConfigError('Не удалось прочитать .env (проверь синтаксис файла)');
    }
  }
}

function readEnv(env: NodeJS.ProcessEnv): z.infer<typeof EnvSchema> {
  const blankToUndefined = (v: string | undefined) => (v && v.trim() !== '' ? v : undefined);
  const parsed = EnvSchema.safeParse({
    MONO_TOKEN: blankToUndefined(env.MONO_TOKEN),
    MONO_DB_PATH: blankToUndefined(env.MONO_DB_PATH),
  });
  if (!parsed.success) {
    // Report field names only — never values (the token must not leak into errors).
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new ConfigError(`Некорректные переменные окружения: ${fields}`);
  }
  return parsed.data;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env) loadEnv();
  const data = readEnv(env);
  const dbPath = resolveDbPath(data.MONO_DB_PATH);
  return { dbPath, dbUrl: `file:${dbPath}`, hasToken: data.MONO_TOKEN !== undefined };
}

/** The only accessor for the token. Callers must never log, persist or return it. */
export function getToken(env: NodeJS.ProcessEnv = process.env): string {
  if (env === process.env) loadEnv();
  const token = readEnv(env).MONO_TOKEN;
  if (!token) {
    throw new ConfigError(
      'MONO_TOKEN не задан. Скопируй .env.example в .env и впиши токен из https://api.monobank.ua/ ' +
        '(или передай MONO_TOKEN через env в конфиге MCP-клиента).',
    );
  }
  return token;
}

// Loaded with `node --import tsx` by tests/cli-args.test.ts: tsx must load .ts from workspace packages via their exports.
import { currencyAlpha } from '@mono/core/currency';
import { SCHEMA_VERSION } from '@mono/core/db';
import { openLibsql } from '@mono/db-libsql';

const db = await openLibsql(':memory:');
const rs = await db.execute('SELECT 41 + 1 AS n');
db.close();
process.stdout.write(`WS ${JSON.stringify({ uah: currencyAlpha(980), schema: SCHEMA_VERSION, n: rs.rows[0]?.n })}\n`);

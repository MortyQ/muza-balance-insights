// Every migration in order. Append-only: a new version is a new file in migrations/ and a new entry at the end;
// an applied entry is never edited.
import type { Migration } from './db.ts';
import { v01 } from './migrations/v01.ts';
import { v02 } from './migrations/v02.ts';
import { v03 } from './migrations/v03.ts';
import { v04 } from './migrations/v04.ts';
import { v05 } from './migrations/v05.ts';
import { v06 } from './migrations/v06.ts';
import { v07 } from './migrations/v07.ts';
import { v08 } from './migrations/v08.ts';
import { v09 } from './migrations/v09.ts';
import { v10 } from './migrations/v10.ts';
import { v11 } from './migrations/v11.ts';
import { v12 } from './migrations/v12.ts';
import { v13 } from './migrations/v13.ts';
import { v14 } from './migrations/v14.ts';
import { v15 } from './migrations/v15.ts';
import { v16 } from './migrations/v16.ts';

export const MIGRATIONS: ReadonlyArray<Migration> = [
  v01,
  v02,
  v03,
  v04,
  v05,
  v06,
  v07,
  v08,
  v09,
  v10,
  v11,
  v12,
  v13,
  v14,
  v15,
  v16,
];

export const SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;

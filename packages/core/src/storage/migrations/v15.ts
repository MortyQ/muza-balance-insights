import type { Migration } from '../db.ts';

export const v15: Migration = {
  version: 15,
  name: 'connection_method',
  // How a connection gets its data (connections.ts CONNECTION_METHODS): 'token' — the bank's API with a credential,
  // 'file' — statement files the user uploads. The connections so far are token ones.
  statements: [`ALTER TABLE connections ADD COLUMN method TEXT NOT NULL DEFAULT 'token' CHECK (method IN ('token', 'file'))`],
};

import type { MessageKey } from '@contract/i18n/index.ts';

export type BankId = 'monobank' | 'privatbank' | 'other';

/** How a bank gives access to the statement: a personal token (Monobank), a sign-in at the bank, a statement file. */
export type BankAuth = 'token' | 'oauth' | 'file';

interface BankDisplay {
  id: BankId;
  /** The dictionary key of the bank's name. */
  name: MessageKey;
  /** Shown when there is no logo file: one or two letters on a square. */
  monogram: string;
  /** Tailwind classes of the monogram square. */
  monogramClass: string;
}

/**
 * What the screens show about a bank; how to connect it lives in its folder in `features/integrations`. `ways` — the
 * ways the user may pick from, the first is the default.
 */
export type Bank = BankDisplay & ({ status: 'available'; ways: ReadonlyArray<BankAuth> } | { status: 'soon' });

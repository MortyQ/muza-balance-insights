/** How a bank gives access to the statement: a personal token (Monobank), a sign-in at the bank, a statement file. */
export type BankAuth = 'token' | 'oauth' | 'file';

/** A bank's mark when it has no logo file: one or two letters on a square. */
export interface BankLook {
  monogram: string;
  /** Tailwind classes of the monogram square. */
  monogramClass: string;
}

/**
 * What the screens show about a bank: its registry entry (@mono/core/providers/info) with its look (`looks/<id>.ts`).
 * How to connect it lives in `features/integrations`. A bank the registry does not know gets a neutral entry.
 */
export interface Bank extends BankLook {
  /** The provider id. */
  id: string;
  /** The brand name, not translated; a bank the registry does not know shows its id. */
  name: string;
  /** The ways the user may pick from, the first is the default; none for a bank the registry does not know. */
  ways: ReadonlyArray<BankAuth>;
}
